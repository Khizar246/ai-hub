# FastAPI application entry point: mounts all agent routers, CORS, and middleware

import asyncio
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core import telemetry
from core.auth import AuthMiddleware, router as auth_router
from core.config import settings
from core.exceptions import register_exception_handlers
from core.housekeeping import periodic_storage_cleanup
from core.logger import get_logger
from core.session_manager import session_manager
from agents.audit.router import router as audit_router
from agents.news.router import router as news_router
from agents.data.router import router as data_router
from middleware.rate_limiter import RateLimiterMiddleware
from middleware.request_logger import RequestLoggerMiddleware

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Connect services on startup; disconnect cleanly on shutdown."""
    logger.info("AI Hub starting up...")
    await session_manager.connect()
    cleanup_task = asyncio.create_task(periodic_storage_cleanup())
    yield
    logger.info("AI Hub shutting down...")
    cleanup_task.cancel()
    await session_manager.disconnect()


app = FastAPI(
    title="AI Hub API",
    description="Unified platform for AI Audit, News Research, and TalkToData agents.",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware executes outermost-last-added: RequestLogger → CORS →
# RateLimiter → Auth → routes, so /auth/login is rate-limited (brute-force
# protection) and CORS preflights never hit the auth gate.
app.add_middleware(AuthMiddleware)
app.add_middleware(RateLimiterMiddleware)

_allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggerMiddleware)

register_exception_handlers(app)

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(audit_router, prefix="/agents/audit", tags=["Audit"])
app.include_router(news_router, prefix="/agents/news", tags=["News"])
app.include_router(data_router, prefix="/agents/data", tags=["Data"])


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Liveness probe used by Docker Compose and load balancers."""
    return {"status": "ok", "version": "1.0.0"}


@app.get("/stats")
async def usage_stats() -> dict:
    """Today's LLM token/cost counters and SQL execution failure rate."""
    return await asyncio.to_thread(telemetry.get_stats)
