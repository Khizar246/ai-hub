# SQLGlot validation + clean_explanation() — ported unchanged from Talk_To_Data_Engine/backend/main.py

import re

import sqlglot


def validate_and_format_sql(sql: str, dialect: str) -> str:
    """
    Transpile SQL through SQLGlot for AST validation and pretty-printing.
    Falls back to the raw SQL if transpilation fails (mirrors original behaviour).
    """
    try:
        return sqlglot.transpile(sql, read=dialect, write=dialect, pretty=True)[0]
    except Exception:
        return sql


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
