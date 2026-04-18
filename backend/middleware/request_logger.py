# Middleware: logs every request with session_id, method, path, status, and latency

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.logger import get_logger

logger = get_logger(__name__)


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: object) -> Response:
        start = time.perf_counter()
        session_id = request.headers.get("X-Session-ID", "anonymous")
        response: Response = await call_next(request)  # type: ignore[operator]
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            f"{request.method} {request.url.path} → {response.status_code} ({duration_ms}ms)",
            extra={"session_id": session_id},
        )
        return response
