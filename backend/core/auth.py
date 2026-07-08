# Access-code login: POST /auth/login issues a Redis-backed bearer token.
# Auth is enabled only when APP_ACCESS_CODE is set — with it unset (the default),
# the API behaves exactly as before. Replace with SSO/OIDC for enterprise use.

import hmac
import secrets

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from core.config import settings
from core.session_manager import session_manager

_TOKEN_TTL = 24 * 3600  # tokens live one day

# Everything sensitive sits behind the gate: agent APIs and cost telemetry.
_PROTECTED_PREFIXES = ("/agents/", "/stats")

router = APIRouter()


class LoginRequest(BaseModel):
    access_code: str


@router.get("/status")
async def auth_status() -> dict:
    """Tell the frontend whether a login gate is active."""
    return {"auth_required": bool(settings.APP_ACCESS_CODE)}


@router.post("/login")
async def login(payload: LoginRequest) -> dict:
    if not settings.APP_ACCESS_CODE:
        return {"token": ""}
    if not hmac.compare_digest(payload.access_code, settings.APP_ACCESS_CODE):
        raise HTTPException(status_code=401, detail="Invalid access code.")
    token = secrets.token_urlsafe(32)
    await session_manager.set(token, "auth", True, ttl=_TOKEN_TTL)
    return {"token": token}


class AuthMiddleware(BaseHTTPMiddleware):
    """Requires a valid bearer token on protected routes when auth is enabled."""

    async def dispatch(self, request: Request, call_next):
        if (
            settings.APP_ACCESS_CODE
            and request.url.path.startswith(_PROTECTED_PREFIXES)
            and request.method != "OPTIONS"
        ):
            token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
            valid = False
            if token:
                try:
                    valid = bool(await session_manager.get(token, "auth"))
                except Exception:
                    valid = False
            if not valid:
                return JSONResponse(
                    status_code=401, content={"detail": "Authentication required."}
                )
        return await call_next(request)
