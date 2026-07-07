# clean_sql_output extraction logic — no LLM calls involved.

from agents.data.llm_service import clean_sql_output

CTE_NO_SEMICOLON = """WITH monthly AS (
  SELECT region, SUM(amount) AS total
  FROM sales
  GROUP BY region
)
SELECT region, total
FROM monthly
ORDER BY total DESC
LIMIT 10"""


def test_multiline_cte_survives_without_semicolon():
    # Regression: the old scanner reset on inner SELECT lines and threw away
    # the WITH header, producing SQL that referenced a nonexistent CTE.
    cleaned = clean_sql_output(CTE_NO_SEMICOLON)
    assert cleaned.startswith("WITH monthly")
    assert "GROUP BY region" in cleaned
    assert cleaned.endswith("LIMIT 10")


def test_markdown_fences_and_trailing_prose_stripped():
    raw = f"```sql\n{CTE_NO_SEMICOLON};\n```\nThis query aggregates sales."
    cleaned = clean_sql_output(raw)
    assert cleaned.startswith("WITH monthly")
    assert cleaned.endswith(";")
    assert "aggregates sales" not in cleaned


def test_leading_prose_stripped():
    raw = "Here is your query:\nSELECT id FROM users LIMIT 10;"
    assert clean_sql_output(raw) == "SELECT id FROM users LIMIT 10;"


def test_plain_sql_passthrough():
    assert clean_sql_output("SELECT 1") == "SELECT 1"


def test_fence_without_language_tag():
    assert clean_sql_output("```\nSELECT 1;\n```") == "SELECT 1;"
