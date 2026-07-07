# Access-code auth flow and rate limiter, exercised on a minimal app
# (no Redis needed — the session store is faked).

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core import auth
from core.auth import AuthMiddleware, router as auth_router
from core.config import settings
from middleware.rate_limiter import RateLimiterMiddleware, _MAX_REQUESTS_PER_WINDOW


class FakeSessionStore:
    def __init__(self):
        self.data = {}

    async def set(self, session_id, field, value, ttl=None):
        self.data[(session_id, field)] = value

    async def get(self, session_id, field):
        return self.data.get((session_id, field))


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(auth, "session_manager", FakeSessionStore())
    app = FastAPI()
    app.add_middleware(AuthMiddleware)
    app.include_router(auth_router, prefix="/auth")

    @app.get("/agents/data/ping")
    async def ping():
        return {"ok": True}

    return TestClient(app)


class TestAuth:
    def test_disabled_by_default(self, client, monkeypatch):
        monkeypatch.setattr(settings, "APP_ACCESS_CODE", "")
        assert client.get("/auth/status").json() == {"auth_required": False}
        assert client.get("/agents/data/ping").status_code == 200

    def test_enabled_blocks_without_token(self, client, monkeypatch):
        monkeypatch.setattr(settings, "APP_ACCESS_CODE", "secret123")
        assert client.get("/auth/status").json() == {"auth_required": True}
        assert client.get("/agents/data/ping").status_code == 401

    def test_wrong_code_rejected(self, client, monkeypatch):
        monkeypatch.setattr(settings, "APP_ACCESS_CODE", "secret123")
        assert client.post("/auth/login", json={"access_code": "wrong"}).status_code == 401

    def test_login_then_access(self, client, monkeypatch):
        monkeypatch.setattr(settings, "APP_ACCESS_CODE", "secret123")
        res = client.post("/auth/login", json={"access_code": "secret123"})
        assert res.status_code == 200
        token = res.json()["token"]
        assert token
        ok = client.get(
            "/agents/data/ping", headers={"Authorization": f"Bearer {token}"}
        )
        assert ok.status_code == 200

    def test_garbage_token_rejected(self, client, monkeypatch):
        monkeypatch.setattr(settings, "APP_ACCESS_CODE", "secret123")
        res = client.get(
            "/agents/data/ping", headers={"Authorization": "Bearer nonsense"}
        )
        assert res.status_code == 401


class TestRateLimiter:
    def test_sliding_window_returns_429(self):
        app = FastAPI()
        app.add_middleware(RateLimiterMiddleware)

        @app.post("/agents/data/ask")
        async def ask():
            return {"ok": True}

        client = TestClient(app)
        headers = {"X-Session-ID": "rate-limit-test-session"}
        for _ in range(_MAX_REQUESTS_PER_WINDOW):
            assert client.post("/agents/data/ask", headers=headers).status_code == 200
        assert client.post("/agents/data/ask", headers=headers).status_code == 429

    def test_unlimited_paths_not_throttled(self):
        app = FastAPI()
        app.add_middleware(RateLimiterMiddleware)

        @app.post("/agents/data/execute")
        async def execute():
            return {"ok": True}

        client = TestClient(app)
        for _ in range(_MAX_REQUESTS_PER_WINDOW + 5):
            assert client.post("/agents/data/execute").status_code == 200
