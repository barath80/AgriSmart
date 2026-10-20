import type { Metadata } from "next";
import Link from "next/link";

import { replyToFarmer } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Badge, Card, ErrorPanel, formatDate, PageHeader, StatTile, Table, Td, TextArea } from "@/components/ui";
import { api } from "@/lib/api";
import { load } from "@/lib/load";
import type { FarmerActivity, SupportThreadDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Farmer conversation" };

export default async function FarmerSupport(props: PageProps<"/support/[farmerId]">) {
  const { farmerId } = await props.params;
  const [thread, activity] = await Promise.all([
    load(api.get<SupportThreadDetail>(`/admin/support/threads/${farmerId}`)),
    load(api.get<FarmerActivity>(`/admin/farmers/${farmerId}/activity`)),
  ]);
  if (!thread.data || !activity.data) return <ErrorPanel message={thread.error ?? activity.error ?? "Could not load this farmer."} />;
  const { farmer, messages } = thread.data;
  const a = activity.data;

  return (
    <>
      <PageHeader
        title={farmer.name || "Unnamed farmer"}
        description={`${farmer.phone} · ${[farmer.district, farmer.state].filter(Boolean).join(", ") || "location not set"} · replies in ${farmer.language.toUpperCase()}`}
        actions={<Link href="/support" className="text-sm text-info hover:underline">← Inbox</Link>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Questions asked" value={a.questions} />
        <StatTile label="Photo diagnoses" value={a.diagnoses} />
        <StatTile label="Voice sessions" value={a.voice_sessions} />
        <StatTile label="Farms" value={a.farms} />
        <StatTile label="Last sign-in" value={a.last_login_at ? formatDate(a.last_login_at) : "never"} hint={`Joined ${formatDate(a.joined_at)}${a.is_active ? "" : " · disabled"}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Conversation">
          <ol className="mb-4 max-h-96 space-y-2 overflow-y-auto" aria-label="Messages">
            {messages.length === 0 ? <li className="text-sm text-ink-3">No messages yet.</li> : null}
            {messages.map((m) => (
              <li key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.sender === "admin" ? "ml-auto bg-brand text-brand-contrast" : "bg-surface-2 text-ink"}`}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-[11px] opacity-70">
                  {m.sender === "admin" ? "You" : "Farmer"} · {formatDate(m.created_at)}
                  {m.sender === "admin" ? (m.read ? " · seen" : " · not seen yet") : ""}
                </p>
              </li>
            ))}
          </ol>
          <ActionForm action={replyToFarmer} submitLabel="Send reply" className="space-y-3">
            <input type="hidden" name="farmer_id" value={farmer.id} />
            <TextArea label="Reply (the farmer reads it in the app)" name="body" required maxLength={2000} rows={3} />
          </ActionForm>
        </Card>

        <Card title="What this farmer asks about">
          {a.top_intents.length ? (
            <div className="flex flex-wrap gap-2">
              {a.top_intents.map((i) => <Badge key={i.intent}>{i.intent.replaceAll("_", " ")} · {i.count}</Badge>)}
            </div>
          ) : <p className="text-sm text-ink-3">No questions yet.</p>}
          <h3 className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Recent photo diagnoses</h3>
          {a.diagnosis_log.length ? (
            <ul className="space-y-1 text-sm">
              {a.diagnosis_log.slice(0, 8).map((d, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{d.kind}: {d.label.replaceAll("_", " ").replaceAll(".", " · ")}</span>
                  <span className="tabular text-ink-2">{Math.round(d.confidence * 100)}% {d.accepted ? "" : "· unsure"}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-3">No photos sent.</p>}
        </Card>
      </div>

      <h2 className="mt-8 mb-2 text-sm font-semibold">Question log</h2>
      <Table head={["When", "Via", "Question", "Answer given", "Handled by"]} empty={!a.queries.length}>
        {a.queries.map((q, i) => (
          <tr key={i}>
            <Td className="whitespace-nowrap text-ink-2">{formatDate(q.at)}</Td>
            <Td>{q.channel}</Td>
            <Td className="max-w-xs">{q.question}</Td>
            <Td className="max-w-md text-ink-2">{q.answer ?? "—"}</Td>
            <Td className="text-xs text-ink-2">{[q.intent, q.handled_by].filter(Boolean).join(" · ")}</Td>
          </tr>
        ))}
      </Table>

      <h2 className="mt-8 mb-2 text-sm font-semibold">Voice and phone calls</h2>
      <Table head={["When", "Channel", "Length", "Turns"]} empty={!a.calls.length}>
        {a.calls.map((c, i) => (
          <tr key={i}>
            <Td className="text-ink-2">{formatDate(c.at)}</Td>
            <Td>{c.channel}</Td>
            <Td className="tabular">{c.seconds != null ? `${Math.round(c.seconds)} s` : "—"}</Td>
            <Td className="tabular">{c.turns}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
