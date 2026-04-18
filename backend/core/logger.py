# Structured JSON logging — single logger factory that replaces three separate loggers

import json
import logging
import sys
from datetime import datetime, timezone


class _JSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, object] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        # Optional structured fields added via extra={"session_id": ..., "agent": ...}
        for field in ("session_id", "agent"):
            if hasattr(record, field):
                entry[field] = getattr(record, field)
        return json.dumps(entry)


def get_logger(name: str) -> logging.Logger:
    """Return a structured JSON logger for the given module name."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_JSONFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger
