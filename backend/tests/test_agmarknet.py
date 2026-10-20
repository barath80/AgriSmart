import pytest

from app.market.agmarknet import AgmarknetProvider, commodity_matches


@pytest.mark.parametrize(
    ("wanted", "reported", "expected"),
    [
        ("Paddy(Dhan)(Common)", "Paddy(Common)", True),
        ("Lentil (Masur)(Whole)", "Lentil(Masur)(Whole)", True),
        ("Tomato", "tomato", True),
        ("Mustard", "Mustard Oil", False),
        ("Black Gram (Urd Beans)(Whole)", "Black Gram Dal(Urd Dal)", False),
        ("Maize", "Wheat", False),
    ],
)
def test_commodity_matching(wanted, reported, expected):
    assert commodity_matches(wanted, reported) is expected


REPORT = {
    "success": True,
    "commodityGroups": [
        {
            "commodities": [
                {
                    "commodityName": "Tomato",
                    "markets": [
                        {
                            "marketCenter": "Salem",
                            "data": [
                                {"variety": "Deshi", "minimumPrice": 1000, "maximumPrice": 1400,
                                 "modalPrice": 1200, "unitOfPrice": "Rs./Quintal"},
                                {"variety": "Bad", "minimumPrice": 900, "maximumPrice": 100,
                                 "modalPrice": 500, "unitOfPrice": "Rs./Quintal"},
                                {"variety": "Nut", "minimumPrice": 10, "maximumPrice": 20,
                                 "modalPrice": 15, "unitOfPrice": "Rs./1000 Nuts"},
                            ],
                        }
                    ],
                },
                {"commodityName": "Onion", "markets": []},
            ]
        }
    ],
}


async def test_fetch_parses_and_drops_unusable_rows(monkeypatch):
    provider = AgmarknetProvider()

    async def fake_get(path, params):
        if path == "/location/state":
            return {"pagination": {"total_pages": 1},
                    "states": [{"id": 7, "state_name": "Tamil Nadu"}]}
        return REPORT

    monkeypatch.setattr(provider, "_get", fake_get)
    prices = await provider.fetch(commodity="Tomato", state="tamil nadu")
    assert [(p.market, p.modal_price, p.state) for p in prices] == [("Salem", 1200.0, "Tamil Nadu")]
    assert await provider.fetch(commodity="Tomato", state="Atlantis") == []


async def test_no_report_in_lookback_window_means_no_prices(monkeypatch):
    provider = AgmarknetProvider()

    async def fake_get(path, params):
        if path == "/location/state":
            return {"pagination": {"total_pages": 1},
                    "states": [{"id": 7, "state_name": "Tamil Nadu"}]}
        return None

    monkeypatch.setattr(provider, "_get", fake_get)
    assert await provider.fetch(commodity="Tomato", state="Tamil Nadu") == []


def test_market_names_are_tidied():
    from app.market.agmarknet import _clean

    assert _clean("Kovilpatti(Uzhavar Sandhai )") == "Kovilpatti (Uzhavar Sandhai)"
    assert _clean("  Salem   APMC ") == "Salem APMC"


async def test_rate_limit_backs_off_and_stops_calling_upstream(monkeypatch):
    import httpx

    from app.core.errors import ServiceUnavailable
    from app.market import agmarknet

    calls = []

    class Client:
        async def get(self, url, **kwargs):
            calls.append(url)
            return httpx.Response(429, headers={"Retry-After": "60"}, request=httpx.Request("GET", url))

    monkeypatch.setattr(agmarknet, "get_http_client", lambda: Client())
    provider = agmarknet.AgmarknetProvider()
    for _ in range(3):
        try:
            await provider._get("/location/state", {"page": 1})
        except ServiceUnavailable:
            pass
        else:
            raise AssertionError("expected ServiceUnavailable")
    assert len(calls) == 1  # the 2nd and 3rd attempts never reached Agmarknet


async def test_fallback_provider_uses_backup_when_primary_is_down():
    from app.core.errors import ServiceUnavailable
    from app.market.providers import FallbackProvider

    class Down:
        name = "agmarknet"

        async def fetch(self, **kwargs):
            raise ServiceUnavailable("down", code="market_unavailable")

    class Up:
        name = "data_gov_in"

        async def fetch(self, **kwargs):
            return ["row"]

    provider = FallbackProvider(Down(), Up())
    assert await provider.fetch(commodity="Wheat", state=None) == ["row"]
    assert provider.name == "data_gov_in"


@pytest.mark.parametrize(
    ("given", "feed_spelling"),
    [("Chhattisgarh", "Chattisgarh"), ("Uttarakhand", "Uttrakhand"), ("Delhi", "NCT of Delhi"),
     ("Puducherry", "Pondicherry"), ("Kerala", "Keralam"), ("Maharashtra", "Maharashtra")],
)
def test_state_spellings_cover_the_feeds_names(given, feed_spelling):
    from app.market.providers import state_spellings

    assert state_spellings(given)[0] == given
    assert feed_spelling in state_spellings(given)


async def test_backup_is_used_when_the_primary_returns_nothing():
    from datetime import date

    from app.market.providers import FallbackProvider, PriceObservation

    class Empty:
        name = "primary"

        async def fetch(self, *, commodity, state):
            return []

    class Full:
        name = "backup"

        async def fetch(self, *, commodity, state):
            return [PriceObservation(state="Kerala", district="", market="M", commodity="Onion",
                                     variety="", grade="", arrival_date=date(2026, 1, 1),
                                     min_price=1, max_price=3, modal_price=2)]

    provider = FallbackProvider(Empty(), Full())
    assert len(await provider.fetch(commodity="Onion", state="Kerala")) == 1
    assert provider.name == "backup"
    assert await FallbackProvider(Empty(), Empty()).fetch(commodity="Onion", state=None) == []


def test_agmarknet_provider_is_created_once_and_reused(monkeypatch):
    from app.core.config import get_settings
    from app.market import providers

    monkeypatch.setenv("MARKET_PROVIDER", "agmarknet")
    monkeypatch.setenv("DATA_GOV_IN_API_KEY", "")
    get_settings.cache_clear()
    monkeypatch.setattr(providers, "_agmarknet", None)
    try:
        first = providers.get_market_provider()
        assert isinstance(first, AgmarknetProvider)
        assert providers.get_market_provider() is first
    finally:
        get_settings.cache_clear()
