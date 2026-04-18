# Redis-backed session store shared across all agents

import json
import uuid
from typing import Any

import redis.asyncio as aioredis

from core.config import settings
from core.logger import get_logger

logger = get_logger(__name__)


class SessionManager:
    """Async Redis wrapper for per-session key/value storage."""

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None  # type: ignore[type-arg]

    async def connect(self) -> None:
        """Initialize async Redis connection — called on app startup."""
        self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        logger.info("Redis session manager connected.")

    async def disconnect(self) -> None:
        """Close Redis connection — called on app shutdown."""
        if self._redis:
            await self._redis.aclose()
            logger.info("Redis session manager disconnected.")

    def _key(self, session_id: str, field: str) -> str:
        return f"session:{session_id}:{field}"

    async def get(self, session_id: str, field: str) -> Any:
        """Retrieve a JSON-decoded value from session storage."""
        assert self._redis is not None, "SessionManager not connected"
        raw = await self._redis.get(self._key(session_id, field))
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw

    async def set(self, session_id: str, field: str, value: Any, ttl: int = 3600) -> None:
        """Store a JSON-serialisable value with optional TTL (default 1 hour)."""
        assert self._redis is not None, "SessionManager not connected"
        await self._redis.set(
            self._key(session_id, field),
            json.dumps(value),
            ex=ttl,
        )

    async def delete(self, session_id: str, field: str) -> None:
        """Remove a specific field from session storage."""
        assert self._redis is not None, "SessionManager not connected"
        await self._redis.delete(self._key(session_id, field))

    async def clear_session(self, session_id: str) -> None:
        """Delete all keys belonging to a session."""
        assert self._redis is not None, "SessionManager not connected"
        pattern = f"session:{session_id}:*"
        async for key in self._redis.scan_iter(pattern):
            await self._redis.delete(key)

    @staticmethod
    def generate_session_id() -> str:
        """Generate a new unique session ID."""
        return str(uuid.uuid4())


session_manager = SessionManager()
