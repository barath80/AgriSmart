"""AgriBrain — the router at the centre of every conversation, on every channel.

    text → NLU (rules) → tool (API / ML model / database / rules) → localized reply
                ↘ no rule matched → LLM intent fallback → tool, or LLM conversation

AgriBrain owns no agricultural facts. It decides *who* answers and assembles the reply.
"""

import logging
import uuid
from dataclasses import replace

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.assistant import tools
from app.assistant.app_guide import APP_GUIDE
from app.assistant.facts import farmer_facts
from app.assistant.intents import Intent
from app.assistant.llm import get_llm, parse_json_object
from app.assistant.models import ChatMessage, ChatSession
from app.assistant.nlu import NluResult, understand
from app.assistant.schemas import AssistantReply
from app.core.database import utcnow
from app.core.errors import AppError, ServiceUnavailable
from app.core.observability import Timer, metrics
from app.crop.service import crop_catalog
from app.farmer.context import FarmerContext
from app.language.templates import render

logger = logging.getLogger(__name__)

_HISTORY_TURNS = 6
# Intents the model may route to; help and small talk are answered by the model itself.
_TOOL_INTENTS = [
    i.value for i in Intent if i not in (Intent.GENERAL, Intent.GREETING, Intent.HELP)
]


_DIAGNOSIS = {Intent.DISEASE_DIAGNOSIS, Intent.PEST_DIAGNOSIS}  # both lead to one photo check
_MAX_TOPICS = 2


def _topics(nlu: NluResult) -> list[Intent]:
    """The distinct things a message asks about, best first: "explain AgriSmart and today's
    weather" is help and weather. Disease and pest count once; greetings not at all."""
    topics: list[Intent] = []
    for intent in (nlu.intent, *nlu.also):
        if intent in (Intent.GENERAL, Intent.GREETING) or intent in topics:
            continue
        if intent in _DIAGNOSIS and any(t in _DIAGNOSIS for t in topics):
            continue
        topics.append(intent)
    return topics[:_MAX_TOPICS]


def _system_prompt(ctx: FarmerContext, facts: str) -> str:
    return (
        "You are AgriSmart, a patient agricultural assistant for small farmers in India. "
        f"Reply ONLY in {ctx.language.native_name} ({ctx.language.value}), written fully in its "
        "own script, in 2-4 short, simple sentences suitable for reading aloud (they are "
        "spoken). If there is more to say, offer to explain further. No markdown, no lists, "
        "no English words unless the farmer is speaking English. "
        "Answer any question a farmer may have: about AgriSmart and how to use it (only from "
        "the guide below; never invent screens or buttons), about their own farm (only from "
        "their records below; if something is not in the records, say where in the app to add "
        "or find it), and general farming questions. "
        "Never state market prices, weather forecasts, scheme eligibility, yields, pesticide "
        "doses or disease diagnoses from memory: say the farmer can ask AgriSmart for those "
        "directly (for example by asking about today's weather or the onion price). For "
        "anything risky (chemicals, health, money) advise confirming with the local "
        "agriculture officer or Kisan Call Centre 1800-180-1551. If unsure, say so.\n\n"
        f"The farmer's AgriSmart records (accurate):\n{facts}\n\n"
        f"AgriSmart guide:\n{APP_GUIDE}"
    )


class AgriBrain:
    async def handle(
        self, session: AsyncSession, ctx: FarmerContext, text: str, session_id: uuid.UUID | None
    ) -> AssistantReply:
        chat = await self._chat_session(session, ctx, session_id)
        with Timer() as timer:
            intent, result = await self._route(session, ctx, chat, text)
        metrics.inc("assistant_intents", f"{intent.value}:{result.handled_by}")
        metrics.observe_ms("assistant_latency", intent.value, timer.ms)

        chat.last_activity_at = utcnow()
        session.add_all(
            [
                ChatMessage(
                    session_id=chat.id, role="farmer", text=text[:4000], intent=intent.value
                ),
                ChatMessage(
                    session_id=chat.id,
                    role="assistant",
                    text=result.text[:4000],
                    intent=intent.value,
                    handled_by=result.handled_by,
                    latency_ms=timer.ms,
                ),
            ]
        )
        await session.commit()
        return AssistantReply(
            session_id=chat.id,
            intent=intent.value,
            handled_by=result.handled_by,
            language=ctx.language,
            text=result.text,
            data=result.data,
            action=result.action,
        )

    async def greet(self, ctx: FarmerContext) -> str:
        return render("voice.welcome", ctx.language)

    async def _route(
        self, session: AsyncSession, ctx: FarmerContext, chat: ChatSession, text: str
    ) -> tuple[Intent, tools.ToolResult]:
        catalog = await crop_catalog(session)
        nlu = understand(text, ctx.language, catalog)
        topics = _topics(nlu)
        if len(topics) > 1:
            # Report the live topic (the app shows its card) rather than "help".
            main = next((t for t in topics if t is not Intent.HELP), topics[0])
            return main, await self._combined(session, ctx, chat, text, nlu, topics)
        if nlu.intent in (Intent.GENERAL, Intent.HELP) and get_llm() is not None:
            # One model call either routes the request to a live tool or answers it (general
            # farming questions, the farmer's own records, and how to use AgriSmart).
            routed = await self._llm_route_or_answer(session, ctx, chat, text, nlu)
            if isinstance(routed, tools.ToolResult):
                return nlu.intent, routed
            nlu = routed
        if nlu.intent is Intent.GENERAL:
            return nlu.intent, tools.ToolResult(
                render("not_understood", ctx.language), handled_by="fallback"
            )
        return nlu.intent, await self._run_tool(session, ctx, nlu)

    async def _run_tool(
        self, session: AsyncSession, ctx: FarmerContext, nlu: NluResult
    ) -> tools.ToolResult:
        try:
            return await tools.TOOLS[nlu.intent](session, ctx, nlu)
        except ServiceUnavailable as exc:
            logger.warning("tool_unavailable", extra={"intent": nlu.intent.value, "code": exc.code})
            return tools.ToolResult(tools.unavailable_text(ctx, exc), handled_by="fallback")
        except AppError as exc:
            logger.info("tool_declined", extra={"intent": nlu.intent.value, "code": exc.code})
            return tools.ToolResult(render("error.generic", ctx.language), handled_by="fallback")

    async def _combined(
        self,
        session: AsyncSession,
        ctx: FarmerContext,
        chat: ChatSession,
        text: str,
        nlu: NluResult,
        topics: list[Intent],
    ) -> tools.ToolResult:
        """A message with several questions: every live part comes from its tool, then the
        model joins them into one answer (adding the app explanation if asked). Without a
        model, the tools' answers are given one after the other."""
        results = [
            await self._run_tool(session, ctx, replace(nlu, intent=topic))
            for topic in topics
            if topic is not Intent.HELP
        ]
        first = results[0] if results else None
        llm = get_llm()
        if llm is not None:
            found = "\n".join(f"- {r.text}" for r in results)
            instruction = (
                "\n\nFor parts of the farmer's latest message AgriSmart has just looked up "
                f"these live answers (accurate):\n{found}\nReply to the whole message in one "
                "answer of up to 6 short sentences: give these results with every number, date "
                "and name unchanged, in the reply language, and answer the remaining parts "
                "yourself (for example what AgriSmart is or how to use it, from the guide)."
            )
            try:
                answer = await llm.complete(
                    await self._prompt(session, ctx) + instruction,
                    await self._messages(session, chat, text),
                )
            except ServiceUnavailable:
                pass
            else:
                return tools.ToolResult(
                    answer,
                    data=first.data if first else None,
                    action=first.action if first else None,
                    handled_by="llm",
                )
        parts = [r.text for r in results]
        if Intent.HELP in topics:
            parts.insert(0, (await tools.help_(session, ctx, nlu)).text)
        return tools.ToolResult(
            " ".join(parts),
            data=first.data if first else None,
            action=first.action if first else None,
        )

    async def _prompt(self, session: AsyncSession, ctx: FarmerContext) -> str:
        return _system_prompt(ctx, await farmer_facts(session, ctx))

    async def _messages(
        self, session: AsyncSession, chat: ChatSession, text: str
    ) -> list[dict[str, str]]:
        history = list(
            await session.scalars(
                select(ChatMessage)
                .where(ChatMessage.session_id == chat.id)
                .order_by(ChatMessage.created_at.desc())
                .limit(_HISTORY_TURNS)
            )
        )[::-1]
        return [
            {"role": "assistant" if m.role == "assistant" else "user", "content": m.text}
            for m in history
        ] + [{"role": "user", "content": text}]

    async def _llm_route_or_answer(
        self,
        session: AsyncSession,
        ctx: FarmerContext,
        chat: ChatSession,
        text: str,
        nlu: NluResult,
    ) -> NluResult | tools.ToolResult:
        """Rules did not settle it: the model picks a live tool, or writes the answer itself.

        Returns the NLU result to run a tool with, or the model's own answer. When the model
        is unavailable the NLU result is returned unchanged (help then gets its fixed text).
        """
        llm = get_llm()
        assert llm is not None
        messages = await self._messages(session, chat, text)
        routing = (
            "\n\nReply with JSON only. If the farmer's latest message asks for live AgriSmart "
            f"data or an AgriSmart tool, one of: {', '.join(_TOOL_INTENTS)}, reply "
            '{"intent": "<that name>", "tomorrow": true|false}. Otherwise reply '
            '{"intent": "general", "answer": "<your reply>"}; this includes questions about '
            "AgriSmart itself or how to use it, about the farmer's own records, and general "
            "farming questions."
        )
        try:
            reply = await llm.complete(
                await self._prompt(session, ctx) + routing, messages, json_mode=True
            )
        except ServiceUnavailable:
            return nlu
        parsed = parse_json_object(reply)
        intent = parsed.get("intent")
        if intent in _TOOL_INTENTS:
            nlu.intent = Intent(intent)
            nlu.day_offset = 1 if parsed.get("tomorrow") is True else nlu.day_offset
            metrics.inc("assistant_llm_routed", nlu.intent.value)
            return nlu
        answer = parsed.get("answer")
        if isinstance(answer, str) and answer.strip():
            return tools.ToolResult(answer.strip(), handled_by="llm")
        return nlu

    async def _chat_session(
        self, session: AsyncSession, ctx: FarmerContext, session_id: uuid.UUID | None
    ) -> ChatSession:
        if session_id is not None:
            chat = await session.scalar(
                select(ChatSession).where(
                    ChatSession.id == session_id, ChatSession.farmer_id == ctx.farmer.id
                )
            )
            if chat is not None:
                chat.language = ctx.language
                return chat
        chat = ChatSession(farmer_id=ctx.farmer.id, channel=ctx.channel, language=ctx.language)
        session.add(chat)
        await session.flush()
        return chat


agribrain = AgriBrain()
