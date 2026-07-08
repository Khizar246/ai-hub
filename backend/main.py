# FastAPI application entry point: mounts all agent routers, CORS, and middleware

import asyncio
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core import telemetry
from core.exceptions import register_exception_handlers
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
    yield
    logger.info("AI Hub shutting down...")
    await session_manager.disconnect()


app = FastAPI(
    title="AI Hub API",
    description="Unified platform for AI Audit, News Research, and TalkToData agents.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(RateLimiterMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggerMiddleware)

register_exception_handlers(app)

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
