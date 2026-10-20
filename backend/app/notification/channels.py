"""Outbound delivery channels behind small interfaces, so providers can be swapped."""

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Protocol

from app.core.config import get_settings
from app.core.http import get_http_client

logger = logging.getLogger(__name__)


class DeliveryError(Exception):
    pass


class SmsSender(Protocol):
    async def send(self, phone: str, text: str) -> None: ...


class ConsoleSmsSender:
    """Development sender: writes the message to the log instead of sending it.

    Replace with an Indian SMS gateway adapter (DLT-registered templates are mandatory
    for commercial SMS in India) before production.
    """

    async def send(self, phone: str, text: str) -> None:
        logger.info("sms_outbound", extra={"to": phone[-4:].rjust(len(phone), "*"), "text": text})


class EmailSender(Protocol):
    async def send(self, to: str, subject: str, text: str) -> None: ...


class ConsoleEmailSender:
    """Development sender: writes the e-mail to the log instead of sending it."""

    async def send(self, to: str, subject: str, text: str) -> None:
        logger.info("email_outbound", extra={"to": to, "subject": subject, "text": text})


class SmtpEmailSender:
    """Plain SMTP (STARTTLS on 587, implicit TLS on 465). Works with Gmail app passwords,
    Brevo, Resend's SMTP relay or any other provider; blocking I/O runs in a thread."""

    async def send(self, to: str, subject: str, text: str) -> None:
        settings = get_settings()
        message = EmailMessage()
        message["From"], message["To"], message["Subject"] = settings.smtp_from, to, subject
        message.set_content(text)
        try:
            await asyncio.to_thread(self._deliver, message)
        except Exception as exc:
            raise DeliveryError(f"smtp error: {type(exc).__name__}") from exc

    @staticmethod
    def _deliver(message: EmailMessage) -> None:
        settings = get_settings()
        context = ssl.create_default_context()
        if settings.smtp_port == 465:
            server = smtplib.SMTP_SSL(settings.smtp_host, 465, timeout=20, context=context)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20)
            server.starttls(context=context)
        with server:
            server.login(settings.smtp_user, settings.smtp_password.get_secret_value())
            server.send_message(message)


class ExpoPushSender:
    """Expo push service — free, no server key needed for Expo-managed tokens."""

    async def send(self, token: str, title: str, body: str, data: dict | None = None) -> None:
        response = await get_http_client().post(
            get_settings().expo_push_url,
            json={
                "to": token,
                "title": title,
                "body": body,
                "data": data or {},
                "sound": "default",
            },
        )
        if response.status_code >= 400:
            raise DeliveryError(f"expo push http {response.status_code}")
        ticket = response.json().get("data", {})
        if ticket.get("status") == "error":
            raise DeliveryError(ticket.get("message", "expo push error")[:300])


class TwilioSmsSender:
    """Twilio Programmable Messaging. Indian carriers require a DLT-registered sender and
    template; Twilio's regulatory bundle for India covers that registration."""

    async def send(self, phone: str, text: str) -> None:
        settings = get_settings()
        sender = (
            {"MessagingServiceSid": settings.twilio_messaging_service_sid}
            if settings.twilio_messaging_service_sid
            else {"From": settings.twilio_phone_number}
        )
        try:
            response = await get_http_client().post(
                f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}"
                "/Messages.json",
                data={"To": phone, "Body": text, **sender},
                auth=(settings.twilio_account_sid, settings.twilio_auth_token.get_secret_value()),
                timeout=15,
            )
        except Exception as exc:
            raise DeliveryError(f"twilio sms transport error: {type(exc).__name__}") from exc
        if response.status_code >= 400:
            # Twilio's error body names the problem (e.g. 21211 invalid number) — never the text.
            code = response.json().get("code") if response.content else None
            raise DeliveryError(f"twilio sms http {response.status_code} code {code}")


def get_sms_sender() -> SmsSender:
    return TwilioSmsSender() if get_settings().sms_provider == "twilio" else ConsoleSmsSender()


def get_email_sender() -> EmailSender:
    return SmtpEmailSender() if get_settings().email_provider == "smtp" else ConsoleEmailSender()


def get_push_sender() -> ExpoPushSender:
    return ExpoPushSender()
