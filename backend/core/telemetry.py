# Best-effort usage telemetry: token/cost/failure counters in Redis.
# Every write is wrapped so telemetry failures can never break a request.

import datetime

import redis

from core.config import settings
from core.logger import get_logger

logger = get_logger(__name__)

# $/MTok (input, output) — used for rough cost estimates in /stats.
# Update when changing CLAUDE_MODEL / CLAUDE_VISION_MODEL.
MODEL_PRICES_PER_MTOK: dict[str, tuple[float, float]] = {
    "claude-sonnet-4-5": (3.00, 15.00),
    "claude-opus-4-5": (5.00, 25.00),
}
_DEFAULT_PRICE = (3.00, 15.00)

_COUNTER_TTL = 60 * 24 * 3600  # keep 60 days of daily counters

_client: redis.Redis | None = None


def _redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(
            settings.REDIS_URL, decode_responses=True, socket_timeout=2
        )
    return _client


def _today() -> str:
    return datetime.date.today().isoformat()


def record_llm_call(
    model: str, input_tokens: int, output_tokens: int, success: bool = True
) -> None:
    """Count one LLM call and its token usage under today's date."""
    try:
        key = f"telemetry:llm:{_today()}"
        pipe = _redis().pipeline()
        pipe.hincrby(key, "calls", 1)
        if not success:
            pipe.hincrby(key, "errors", 1)
        pipe.hincrby(key, f"{model}:input_tokens", int(input_tokens))
        pipe.hincrby(key, f"{model}:output_tokens", int(output_tokens))
        pipe.expire(key, _COUNTER_TTL)
        pipe.execute()
    except Exception as exc:
        logger.warning(f"LLM telemetry write skipped: {exc}")


def record_sql_execution(success: bool) -> None:
    """Count one TalkToData SQL execution — the product's core quality KPI."""
    try:
        key = f"telemetry:sql:{_today()}"
        pipe = _redis().pipeline()
        pipe.hincrby(key, "executions", 1)
        if not success:
            pipe.hincrby(key, "failures", 1)
        pipe.expire(key, _COUNTER_TTL)
        pipe.execute()
    except Exception as exc:
        logger.warning(f"SQL telemetry write skipped: {exc}")


def get_stats() -> dict:
    """Aggregate today's counters plus an estimated LLM cost."""
    try:
        llm = _redis().hgetall(f"telemetry:llm:{_today()}")
        sql = _redis().hgetall(f"telemetry:sql:{_today()}")
    except Exception as exc:
        return {"error": f"Telemetry unavailable: {exc}"}

    models: dict[str, dict[str, int]] = {}
    for field, value in llm.items():
        if field.endswith((":input_tokens", ":output_tokens")):
            model, kind = field.rsplit(":", 1)
            models.setdefault(model, {"input_tokens": 0, "output_tokens": 0})[kind] = int(value)

    estimated_cost = 0.0
    for model, tokens in models.items():
        in_price, out_price = MODEL_PRICES_PER_MTOK.get(model, _DEFAULT_PRICE)
        estimated_cost += (
            tokens["input_tokens"] / 1e6 * in_price
            + tokens["output_tokens"] / 1e6 * out_price
        )

    executions = int(sql.get("executions", 0))
    failures = int(sql.get("failures", 0))
    return {
        "date": _today(),
        "llm": {
            "calls": int(llm.get("calls", 0)),
            "errors": int(llm.get("errors", 0)),
            "models": models,
            "estimated_cost_usd": round(estimated_cost, 4),
        },
        "sql": {
            "executions": executions,
            "failures": failures,
            "failure_rate": round(failures / executions, 3) if executions else 0.0,
        },
    }
