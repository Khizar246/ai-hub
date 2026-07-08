# Periodic cleanup of session-scoped storage (uploaded files, session SQLite
# DBs, exports). Sessions expire from Redis after 24h; their files must not
# outlive them, or the disk fills up over time.

import asyncio
import time
from pathlib import Path

from core.config import settings
from core.logger import get_logger

logger = get_logger(__name__)

_MAX_AGE_S = 24 * 3600  # matches the data-agent session TTL
_SWEEP_INTERVAL_S = 3600


def _sweep_dir(root: Path, cutoff: float) -> int:
    """Delete files older than `cutoff` under `root`; prune emptied dirs."""
    if not root.exists():
        return 0
    removed = 0
    for path in root.rglob("*"):
        try:
            if path.is_file() and path.stat().st_mtime < cutoff:
                path.unlink()
                removed += 1
        except OSError:
            continue  # file in use (e.g. open SQLite DB) — retry next sweep
    for path in sorted((p for p in root.rglob("*") if p.is_dir()), reverse=True):
        try:
            path.rmdir()  # only succeeds when empty
        except OSError:
            pass
    return removed


async def periodic_storage_cleanup() -> None:
    """Run as a background task from the app lifespan."""
    while True:
        cutoff = time.time() - _MAX_AGE_S
        removed = 0
        for base in (settings.UPLOADS_PATH, settings.EXPORTS_PATH):
            removed += await asyncio.to_thread(_sweep_dir, Path(base), cutoff)
        if removed:
            logger.info(f"Storage cleanup removed {removed} stale file(s)")
        await asyncio.sleep(_SWEEP_INTERVAL_S)
