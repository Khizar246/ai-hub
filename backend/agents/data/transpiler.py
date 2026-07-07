# SQLGlot validation + clean_explanation() — ported from Talk_To_Data_Engine/backend/main.py
# with dialect-name mapping and a read-only statement guard added on top.

import re

import sqlglot
from sqlglot import exp

from core.logger import get_logger

logger = get_logger(__name__)

# App dialect names → SQLGlot dialect names. SQLGlot does NOT accept
# "postgresql" or "mssql"; passing them raises ValueError and validation
# silently no-ops. Everything must go through this map.
_SQLGLOT_DIALECTS = {
    "sqlite": "sqlite",
    "postgres": "postgres",
    "postgresql": "postgres",
    "mysql": "mysql",
    "mssql": "tsql",
    "tsql": "tsql",
}

# Statement roots that are pure reads. Everything else (INSERT/UPDATE/DELETE/
# DDL/commands) is rejected by assert_read_only().
_READ_ONLY_ROOTS = (exp.Select, exp.Union, exp.Intersect, exp.Except)

_READ_ONLY_FALLBACK = re.compile(r"^\s*(WITH|SELECT)\b", re.IGNORECASE)


def to_sqlglot_dialect(dialect: str) -> str:
    """Map an app-level dialect name to the name SQLGlot understands."""
    return _SQLGLOT_DIALECTS.get((dialect or "").lower(), "sqlite")


def validate_and_format_sql(sql: str, dialect: str) -> str:
    """
    Transpile SQL through SQLGlot for AST validation and pretty-printing.
    Falls back to the raw SQL if transpilation fails, but logs the failure
    instead of hiding it.
    """
    sqlglot_dialect = to_sqlglot_dialect(dialect)
    try:
        return sqlglot.transpile(sql, read=sqlglot_dialect, write=sqlglot_dialect, pretty=True)[0]
    except Exception as exc:
        logger.warning(f"SQLGlot validation failed (dialect={sqlglot_dialect}): {exc}")
        return sql


def assert_read_only(sql: str, dialect: str) -> None:
    """
    Raise ValueError unless every statement in `sql` is a read (SELECT / set
    operation, including CTE-wrapped ones). Blocks INSERT/UPDATE/DELETE/DDL
    so generated or hand-edited SQL can never mutate the connected database.
    """
    try:
        statements = [s for s in sqlglot.parse(sql, read=to_sqlglot_dialect(dialect)) if s is not None]
    except Exception:
        statements = []

    if statements:
        for stmt in statements:
            if not isinstance(stmt, _READ_ONLY_ROOTS):
                raise ValueError(
                    f"Only read-only SELECT queries can be executed (found {stmt.key.upper()})."
                )
        return

    # SQLGlot couldn't parse it — fall back to a keyword check so odd but
    # harmless dialect quirks still run while writes stay blocked.
    if not _READ_ONLY_FALLBACK.match(sql or ""):
        raise ValueError("Only read-only SELECT queries can be executed.")


def clean_explanation(text: str) -> str:
    """Remove 'fourth wall' breaks from AI output — ported as-is from original main.py."""
    forbidden = [
        "as per your request",
        "logic is not present",
        "not mentioned in the prompt",
    ]
    for phrase in forbidden:
        text = re.sub(phrase, "", text, flags=re.IGNORECASE)
    return text.strip()
