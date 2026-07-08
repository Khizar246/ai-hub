# Rate limiter middleware, exercised on a minimal app (no Redis needed).

from fastapi import FastAPI
from fastapi.testclient import TestClient

from middleware.rate_limiter import RateLimiterMiddleware, _MAX_REQUESTS_PER_WINDOW


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
