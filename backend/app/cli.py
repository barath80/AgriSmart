"""Operational commands.

python -m app.cli seed                         # load crops, diseases, pests, schemes
python -m app.cli create-admin EMAIL           # prompts for a password
python -m app.cli set-password EMAIL_OR_PHONE  # reset any account's password (stored hashed)
python -m app.cli register-model crop crop_v1 --activate
python -m app.cli activate-model crop crop_v1  # also used to roll back
python -m app.cli sync-schemes                 # pull live schemes (SCHEME_PROVIDER=myscheme)
python -m app.cli warm-translations [--scope all]  # pre-translate (all = + disease/pest)
"""

import argparse
import asyncio
import getpass
import json
import sys

import anyio
from sqlalchemy import select

from app.auth.models import User
from app.core.database import SessionFactory, engine
from app.core.errors import AppError
from app.core.http import close_http_client
from app.core.security import Role, hash_password
from app.crop.models import Crop
from app.disease.models import Disease
from app.market.importer import parse_csv
from app.market.service import import_prices as market_import
from app.ml.registry import ModelName, activate_model, register_model
from app.pest.models import Pest
from app.schemes.providers import SEED_DIR, VerifiedFileProvider
from app.schemes.service import sync_from_provider
from app.schemes.sync import sync_live_schemes


def _load(name: str) -> list[dict]:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


async def _upsert(session, model, records: list[dict]) -> int:
    for record in records:
        row = await session.scalar(select(model).where(model.slug == record["slug"]))
        if row is None:
            session.add(model(**record))
        else:
            for key, value in record.items():
                setattr(row, key, value)
    return len(records)


async def seed() -> None:
    async with SessionFactory() as session:
        crops = await _upsert(session, Crop, _load("crops.json"))
        diseases = await _upsert(session, Disease, _load("diseases.json"))
        pests = await _upsert(session, Pest, _load("pests.json"))
        await session.commit()
        schemes = await sync_from_provider(session, VerifiedFileProvider())
    print(
        f"Seeded {crops} crops, {diseases} disease entries, {pests} pest entries, "
        f"{schemes} schemes."
    )


async def import_prices(path: str, state: str | None) -> None:
    parsed = parse_csv(await anyio.Path(path).read_bytes(), default_state=state)
    async with SessionFactory() as session:
        count = await market_import(session, parsed.observations, "csv_import")
    print(f"Imported {count} price rows; skipped {len(parsed.skipped_rows)} unreadable rows.")


async def sync_schemes_now() -> None:
    async with SessionFactory() as session:
        report = await sync_live_schemes(session)
    if report is None:
        sys.exit("Set SCHEME_PROVIDER=myscheme and MYSCHEME_API_KEY to sync live schemes.")
    print(
        f"Synced {report.synced} schemes from {report.source}: {report.new} new, "
        f"{report.retired} retired, {report.announced} announced."
    )


async def warm(scope: str) -> None:
    from app.language.warmup import warm_translations

    async with SessionFactory() as session:
        done = await warm_translations(session, scope=scope)
    print("Cached translations per language:", ", ".join(f"{k}={v}" for k, v in done.items()))


async def create_admin(email: str) -> None:
    password = getpass.getpass("Password (min 12 chars): ")
    if len(password) < 12:
        sys.exit("Password too short.")
    async with SessionFactory() as session:
        if await session.scalar(select(User).where(User.email == email.lower())):
            sys.exit("That e-mail is already registered.")
        session.add(
            User(role=Role.ADMIN, email=email.lower(), password_hash=hash_password(password))
        )
        await session.commit()
    print(f"Admin {email} created.")


async def set_password(identifier: str) -> None:
    """Choose a new password for an admin (e-mail) or a farmer (e-mail or +91 phone number)."""
    password = getpass.getpass("New password (min 12 chars for admins, 8 for farmers): ")
    async with SessionFactory() as session:
        key = identifier.lower()
        user = await session.scalar(
            select(User).where((User.email == key) | (User.phone == identifier))
        )
        if user is None:
            sys.exit("No account with that e-mail or phone number.")
        if len(password) < (12 if user.role is Role.ADMIN else 8):
            sys.exit("Password too short.")
        user.password_hash = hash_password(password)
        user.failed_logins, user.locked_until = 0, None
        await session.commit()
    print(f"Password updated for {identifier}.")


async def register(name: str, version: str, activate: bool) -> None:
    async with SessionFactory() as session:
        await register_model(session, ModelName(name), version)
        if activate:
            await activate_model(session, ModelName(name), version)
        await session.commit()
    print(f"Registered {name}/{version}{' (active)' if activate else ''}.")


async def activate(name: str, version: str) -> None:
    async with SessionFactory() as session:
        await activate_model(session, ModelName(name), version)
        await session.commit()
    print(f"{name}/{version} is now active.")


async def lock_down_public_api() -> None:
    """On Supabase, every table in `public` is also served over its REST API to anyone holding the
    project's (public) anon key. The backend connects as the table owner, which ignores row
    security, so turning it on with no policies and revoking the API roles' grants closes that
    door without affecting the app. A no-op on any database without those roles."""
    from sqlalchemy import text

    async with SessionFactory() as session:
        if not await session.scalar(text("select 1 from pg_roles where rolname = 'anon'")):
            return
        tables = (
            await session.scalars(
                text("select tablename from pg_tables where schemaname = 'public'")
            )
        ).all()
        for table in tables:
            await session.execute(text(f'alter table public."{table}" enable row level security'))
        await session.execute(
            text("revoke all on all tables in schema public from anon, authenticated")
        )
        await session.execute(
            text("revoke all on all sequences in schema public from anon, authenticated")
        )
        await session.commit()
    print(f"Row security on and API-role access revoked for {len(tables)} tables.")


async def bootstrap() -> None:
    """Idempotent first-run setup for hosts with no shell: seed the reference data, register and
    activate the newest model on disk for every model that has none active, and create the
    admin from ADMIN_EMAIL / ADMIN_PASSWORD when both are set."""
    import os
    import re

    from app.core.config import get_settings
    from app.ml.models import MLModel

    await lock_down_public_api()
    await seed()
    root = get_settings().model_dir
    for name in ModelName:
        versions = sorted(
            (int(m.group(1)), d.name)
            for d in (root / name.value).glob(f"{name.value}_v*")
            if d.is_dir() and (m := re.fullmatch(rf"{name.value}_v(\d+)", d.name))
        )
        if not versions:
            print(f"No {name.value} model found in {root}; skipping.")
            continue
        version = versions[-1][1]
        async with SessionFactory() as session:
            if await session.scalar(
                select(MLModel.id).where(MLModel.name == name.value, MLModel.is_active.is_(True))
            ):
                continue
            if not await session.scalar(
                select(MLModel.id).where(MLModel.name == name.value, MLModel.version == version)
            ):
                await register_model(session, name, version)
            await activate_model(session, name, version)
            await session.commit()
        print(f"Activated {name.value}/{version}.")
    email, password = os.environ.get("ADMIN_EMAIL"), os.environ.get("ADMIN_PASSWORD")
    if email and password and len(password) >= 12:
        async with SessionFactory() as session:
            if not await session.scalar(select(User).where(User.email == email.lower())):
                session.add(
                    User(
                        role=Role.ADMIN, email=email.lower(), password_hash=hash_password(password)
                    )
                )
                await session.commit()
                print(f"Admin {email} created.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("seed")
    commands.add_parser("bootstrap", help="seed, register the newest models, create the admin")
    admin = commands.add_parser("create-admin")
    admin.add_argument("email")
    reset = commands.add_parser("set-password")
    reset.add_argument("identifier")
    reg = commands.add_parser("register-model")
    reg.add_argument("name", choices=[m.value for m in ModelName])
    reg.add_argument("version")
    reg.add_argument("--activate", action="store_true")
    prices = commands.add_parser(
        "import-prices", help="load a mandi price CSV (Agmarknet / data.gov.in)"
    )
    prices.add_argument("file")
    prices.add_argument("--state", help="state for files without a State column")
    commands.add_parser("sync-schemes")
    warm_parser = commands.add_parser("warm-translations")
    warm_parser.add_argument("--scope", choices=["schemes", "all"], default="schemes")
    act = commands.add_parser("activate-model")
    act.add_argument("name", choices=[m.value for m in ModelName])
    act.add_argument("version")
    args = parser.parse_args()

    async def run() -> None:
        try:
            match args.command:
                case "seed":
                    await seed()
                case "bootstrap":
                    await bootstrap()
                case "create-admin":
                    await create_admin(args.email)
                case "set-password":
                    await set_password(args.identifier)
                case "register-model":
                    await register(args.name, args.version, args.activate)
                case "import-prices":
                    await import_prices(args.file, args.state)
                case "activate-model":
                    await activate(args.name, args.version)
                case "sync-schemes":
                    await sync_schemes_now()
                case "warm-translations":
                    await warm(args.scope)
        except AppError as exc:
            sys.exit(f"Error: {exc.message}")
        finally:
            await close_http_client()
            await engine.dispose()

    asyncio.run(run())


if __name__ == "__main__":
    main()
