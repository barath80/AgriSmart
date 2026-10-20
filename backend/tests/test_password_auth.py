"""Free password sign-in: register, sign in on any device, lock-out, change and reset."""

import pytest
from sqlalchemy import select

from app.auth.models import User
from app.core.database import SessionFactory
from tests.conftest import sms

API = "/api/v1"
PASSWORD = "Green-field-42"
_numbers = iter(range(8_100_000_000, 8_199_999_999))
PHONE = ""


@pytest.fixture(autouse=True)
def fresh_phone():
    """The test database is shared, so every test gets its own phone number."""
    global PHONE
    PHONE = str(next(_numbers))


def _code(phone: str) -> str:
    return next(t.split(": ")[1][:6] for to, t in reversed(sms.sent) if to.endswith(phone))


async def _register(client, **extra):
    body = {"phone": PHONE, "password": PASSWORD, "name": "Ramesh", "language": "te", **extra}
    return await client.post(f"{API}/auth/register", json=body)


async def test_register_then_sign_in_again_with_the_same_password(client):
    created = await _register(client)
    assert created.status_code == 201, created.text
    assert created.json()["role"] == "farmer" and created.json()["is_new_user"] is True

    # A second device (web or phone) signs in with just the number and password.
    again = await client.post(
        f"{API}/auth/password-login", json={"phone": PHONE, "password": PASSWORD}
    )
    assert again.status_code == 200, again.text
    headers = {"Authorization": f"Bearer {again.json()['access_token']}"}
    profile = (await client.get(f"{API}/farmer/profile", headers=headers)).json()
    assert profile["name"] == "Ramesh" and profile["preferred_language"] == "te"
    assert profile["phone"] == "+91" + PHONE


async def test_password_is_stored_only_as_an_argon2_hash(client):
    await _register(client)
    async with SessionFactory() as session:
        user = await session.scalar(select(User).where(User.phone == "+91" + PHONE))
    assert user.password_hash.startswith("$argon2")
    assert PASSWORD not in user.password_hash


async def test_wrong_password_and_unknown_account_get_the_same_answer(client):
    await _register(client)
    wrong = await client.post(
        f"{API}/auth/password-login", json={"phone": PHONE, "password": "nope-nope-1"}
    )
    unknown = await client.post(
        f"{API}/auth/password-login", json={"phone": "9123456780", "password": "nope-nope-1"}
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["error"]["message"] == unknown.json()["error"]["message"]


async def test_account_locks_after_five_wrong_passwords_and_unlocks_on_success_path(client):
    await _register(client)
    for _ in range(5):
        r = await client.post(
            f"{API}/auth/password-login", json={"phone": PHONE, "password": "bad-password-1"}
        )
        assert r.status_code == 401
    locked = await client.post(
        f"{API}/auth/password-login", json={"phone": PHONE, "password": PASSWORD}
    )
    assert locked.status_code == 429 and locked.json()["error"]["code"] == "account_locked"


async def test_registering_an_existing_number_is_refused(client):
    assert (await _register(client)).status_code == 201
    second = await _register(client, password="Another-pass-9")
    assert second.status_code == 409 and second.json()["error"]["code"] == "account_exists"
    # The original password still works: the second attempt changed nothing.
    ok = await client.post(
        f"{API}/auth/password-login", json={"phone": PHONE, "password": PASSWORD}
    )
    assert ok.status_code == 200


async def test_short_passwords_are_rejected(client):
    assert (await _register(client, password="short")).status_code == 422


async def test_email_accounts_work_the_same_way(client):
    body = {"email": f"Grower{PHONE}@Example.com", "password": PASSWORD, "language": "hi"}
    assert (await client.post(f"{API}/auth/register", json=body)).status_code == 201
    login = await client.post(
        f"{API}/auth/password-login",
        json={"email": f"grower{PHONE}@example.com", "password": PASSWORD},
    )
    assert login.status_code == 200


async def test_change_password_needs_the_current_one(client):
    tokens = (await _register(client)).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    bad = await client.put(
        f"{API}/auth/password",
        headers=headers,
        json={"current_password": "wrong-one-1", "new_password": "Brand-new-77"},
    )
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "wrong_password"
    good = await client.put(
        f"{API}/auth/password",
        headers=headers,
        json={"current_password": PASSWORD, "new_password": "Brand-new-77"},
    )
    assert good.status_code == 204
    old = await client.post(
        f"{API}/auth/password-login", json={"phone": PHONE, "password": PASSWORD}
    )
    new = await client.post(
        f"{API}/auth/password-login", json={"phone": PHONE, "password": "Brand-new-77"}
    )
    assert old.status_code == 401 and new.status_code == 200


async def test_account_made_with_a_code_can_add_a_password_later(client):
    await client.post(f"{API}/auth/otp", json={"phone": PHONE})
    code = _code(PHONE)
    tokens = (await client.post(f"{API}/auth/login", json={"phone": PHONE, "otp": code})).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    # Before a password exists, password sign-in is refused and the number cannot be re-registered.
    assert (
        await client.post(f"{API}/auth/password-login", json={"phone": PHONE, "password": PASSWORD})
    ).status_code == 401
    assert (await _register(client)).status_code == 409
    set_first = await client.put(
        f"{API}/auth/password", headers=headers, json={"new_password": PASSWORD}
    )
    assert set_first.status_code == 204
    assert (
        await client.post(f"{API}/auth/password-login", json={"phone": PHONE, "password": PASSWORD})
    ).status_code == 200


async def test_forgot_password_with_a_code_resets_it_and_signs_out_old_sessions(client):
    old = (await _register(client)).json()
    await client.post(f"{API}/auth/otp", json={"phone": PHONE})
    code = _code(PHONE)
    reset = await client.post(
        f"{API}/auth/password-reset",
        json={"phone": PHONE, "otp": code, "new_password": "Reset-pass-55"},
    )
    assert reset.status_code == 200, reset.text
    assert (
        await client.post(f"{API}/auth/refresh", json={"refresh_token": old["refresh_token"]})
    ).status_code == 401
    assert (
        await client.post(
            f"{API}/auth/password-login", json={"phone": PHONE, "password": "Reset-pass-55"}
        )
    ).status_code == 200


async def test_reset_with_a_wrong_code_changes_nothing(client):
    await _register(client)
    await client.post(f"{API}/auth/otp", json={"phone": PHONE})
    bad = await client.post(
        f"{API}/auth/password-reset",
        json={"phone": PHONE, "otp": "000000", "new_password": "Hacker-pass-1"},
    )
    assert bad.status_code == 401
    assert (
        await client.post(f"{API}/auth/password-login", json={"phone": PHONE, "password": PASSWORD})
    ).status_code == 200


async def test_admin_account_cannot_use_the_farmer_password_route(client, admin):
    r = await client.post(
        f"{API}/auth/password-login",
        json={"email": "admin@agrismart.in", "password": "correct-horse-battery"},
    )
    assert r.status_code == 401
