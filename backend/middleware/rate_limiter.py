# Per-session rate limiting middleware for LLM-heavy endpoints.

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# POST paths that trigger LLM calls, heavy processing, or need brute-force
# protection (/login) — keep in sync with agent routers.
_LIMITED_PATH_SUFFIXES = ("/ask", "/audit", "/ingest", "/login")

_WINDOW_SECONDS = 60
_MAX_REQUESTS_PER_WINDOW = 20
_PRUNE_THRESHOLD = 10_000  # cap tracked keys so memory can't grow unbounded


def _client_key(request: Request) -> str:
    """Rate-limit key: the client IP. The X-Session-ID header is client-chosen
    and trivially rotated, so it must not be the key. Behind a proxy (Railway)
    the real IP is the first hop in X-Forwarded-For."""
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "anonymous"


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Sliding-window limiter keyed by client IP."""

    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, now: float) -> None:
        if len(self._hits) < _PRUNE_THRESHOLD:
            return
        stale = [
            key for key, hits in self._hits.items()
            if not hits or now - hits[-1] > _WINDOW_SECONDS
        ]
        for key in stale:
            del self._hits[key]

    async def dispatch(self, request: Request, call_next):
        if request.method == "POST" and request.url.path.endswith(_LIMITED_PATH_SUFFIXES):
            key = _client_key(request)
            now = time.monotonic()
            self._prune(now)
            hits = self._hits[key]
            while hits and now - hits[0] > _WINDOW_SECONDS:
                hits.popleft()
            if len(hits) >= _MAX_REQUESTS_PER_WINDOW:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded — please wait a moment and try again."},
                )
            hits.append(now)
        return await call_next(request)
