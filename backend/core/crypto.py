# Fernet encryption for secrets persisted in Redis (DB credentials).
# The key derives from SESSION_SECRET_KEY (or ANTHROPIC_API_KEY as fallback),
# so rotating either invalidates stored credentials — sessions simply
# re-prompt for the connection, nothing breaks.

import base64
import hashlib
import json
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet

from core.config import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    secret = settings.SESSION_SECRET_KEY or settings.ANTHROPIC_API_KEY
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


def encrypt_json(data: Any) -> str:
    """Serialise `data` to JSON and encrypt it to a printable token."""
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def decrypt_json(token: Any) -> Any:
    """Decrypt a token from encrypt_json(). Returns None for anything invalid
    (wrong key after rotation, legacy plaintext values, non-strings)."""
    if not isinstance(token, str) or not token:
        return None
    try:
        return json.loads(_fernet().decrypt(token.encode()))
    except Exception:
        return None
