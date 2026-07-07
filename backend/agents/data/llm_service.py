# SQL generation and explanation prompts ported EXACTLY from Talk_To_Data_Engine/backend/app/services/llm_service.py.
# Only change: Ollama HTTP call replaced with core/llm_client.call_claude().

import json
import re

from core.exceptions import AgentError
from core.llm_client import call_claude
from core.logger import get_logger

logger = get_logger(__name__)


def get_sql(schema: str, question: str, dialect: str = "sqlite") -> str:
    """
    Generate SQL using the High-Performance Expert Prompt (prompt ported as-is).
    Returns cleaned SQL string ready for SQLGlot validation.
    """
    dialect_note = (
        "industry-standard PostgreSQL" if dialect in ("postgres", "postgresql")
        else "MySQL" if dialect == "mysql"
        else "Microsoft SQL Server (T-SQL)" if dialect == "tsql"
        else "industry-standard SQLite"
    )

    prompt = (
        f"### SYSTEM INSTRUCTION\n"
        f"You are an expert SQL Analyst. Your goal is to produce {dialect_note} queries that pass strict AST validation.\n\n"
        f"### DATABASE SCHEMA\n{schema}\n\n"
        f"### ANALYTICAL RULES\n"
        f"1. JOIN STRUCTURE (CRITICAL):\n"
        f"   - Always use explicit JOIN ... ON syntax.\n"
        f"   - NEVER use comma-style joins (e.g., FROM tableA, tableB).\n"
        f"   - Every table in a JOIN must have a clear ON or USING condition to prevent Cartesian products.\n"
        f"2. AGGREGATES: For 'most', 'highest', 'maximum', 'least', 'lowest', or 'minimum' queries:\n"
        f"   - Compute the aggregate explicitly.\n"
        f"   - Return the aggregate value in the SELECT list.\n"
        f"   - Handle ties explicitly. Do NOT use LIMIT 1 unless the question explicitly asks for exactly one result.\n"
        f"3. GROUP BY: Always group by all non-aggregated columns.\n"
        f"   IDENTIFIERS: If a table or column name contains spaces or special characters, "
        f"quote it using the correct style for the dialect "
        f"(\"double quotes\" for SQLite/PostgreSQL, `backticks` for MySQL, [brackets] for SQL Server). "
        f"Copy identifier names EXACTLY as they appear in the schema — never invent or rename columns.\n"
        f"4. SINGLE TABLE RULE:\n"
        f"   - If the schema contains only one table, assume a denormalized structure.\n"
        f"   - Include descriptive columns in GROUP BY when aggregating.\n"
        f"5. TIES AND RANKING:\n"
        f"   - Prefer MAX()/MIN() subqueries or RANK() over LIMIT 1.\n"
        f"   - If using SQLite: Do NOT use ROW_NUMBER().\n"
        f"6. CTEs: Prefer WITH clauses (Common Table Expressions) for clarity in all complex logic.\n\n"
        f"### ADDITIONAL SQL RULES\n"
        f"1. NEVER use SELECT * — always select specific columns that are relevant to the question\n"
        f"2. Only use CTEs (WITH clauses) when the query genuinely requires reusing logic or has multiple steps. For simple aggregations or single-table queries, write direct SQL without CTEs\n"
        f"3. Date filtering by month:\n"
        f"   SQLite: strftime('%m', date_column) = '03'\n"
        f"   PostgreSQL: EXTRACT(MONTH FROM date_column) = 3\n"
        f"   MySQL: MONTH(date_column) = 3\n"
        f"   SQL Server (tsql): MONTH(date_column) = 3 or DATEPART(month, date_column) = 3\n"
        f"   Use the pattern appropriate for the {dialect} dialect.\n"
        f"4. Always add LIMIT 10 at the end of every SELECT query unless the user explicitly asks for all records or a specific number. Never return unbounded result sets\n\n"
        f"### OUTPUT RULES (CRITICAL)\n"
        f"- Return ONLY the raw SQL query. Nothing else.\n"
        f"- NO explanations, NO markdown, NO backticks, NO preamble\n"
        f"- NO thinking out loud, NO 'let me reconsider', NO alternative interpretations\n"
        f"- NO natural language before or after the SQL\n"
        f"- If you are uncertain, pick the most likely interpretation and generate SQL for it silently\n"
        f"- The ENTIRE response must be valid SQL that can be executed directly\n"
        f"- End the query with a semicolon\n\n"
        f"### SELF-CHECK PROTOCOL\n"
        f"Before finalizing:\n"
        f"- Did I use a comma in the FROM clause? (If yes, replace with JOIN...ON).\n"
        f"- Does every JOIN have an ON clause?\n"
        f"- Is the query tie-safe? (Does it use subqueries to find the max/min?)\n"
        f"- Is the output ONLY code?\n\n"
        f"### TASK\n"
        f"User Question: {question}\n"
        f"SQL Query:"
    )

    try:
        response = call_claude(prompt, temperature=0.0, max_tokens=1024)
        return clean_sql_output(response)
    except Exception as exc:
        logger.error(f"SQL generation failed: {exc}")
        raise AgentError(f"SQL generation failed: {exc}") from exc


def get_explanation(query: str) -> str:
    """
    Generate a two-sentence technical explanation of the SQL query (prompt ported as-is).
    Includes the refusal guardrail from the original llm_service.py.
    """
    prompt = (
        f"Explain this SQL query in plain English for a non-technical user.\n\n"
        f"SQL:\n{query}\n\n"
        f"First assess the complexity of this query:\n"
        f"- SIMPLE: single table, no joins, no aggregations, no subqueries\n"
        f"- MEDIUM: has joins, filters, or basic aggregations (GROUP BY, COUNT, SUM)\n"
        f"- COMPLEX: has CTEs, subqueries, window functions, or 3+ joins\n\n"
        f"Then write the explanation following these rules:\n\n"
        f"For SIMPLE queries:\n"
        f"- 1 sentence summary\n"
        f"- 1-2 lines max total\n"
        f"- Example: 'Shows all orders in the database. Returns every row from the orders table with no filters.'\n\n"
        f"For MEDIUM queries:\n"
        f"- 1 sentence summary\n"
        f"- 2-4 bullet points covering only the relevant steps (Tables, Filter, Result, Calculation — only include what applies)\n"
        f"- 5-7 lines max total\n\n"
        f"For COMPLEX queries:\n"
        f"- 1 sentence summary\n"
        f"- 4-6 bullet points covering all meaningful steps\n"
        f"- Up to 10 lines\n\n"
        f"Global rules for all complexity levels:\n"
        f"- Start with the one-line summary\n"
        f"- Bullet points use this format exactly: '- Label: explanation' (e.g. '- Tables: ...')\n"
        f"- Labels should be chosen based on what applies: Tables, Filter, Data, Calculation, Grouping, Result, Subquery, CTE\n"
        f"- No SQL jargon or technical terms\n"
        f"- Do NOT restate or describe SQL syntax\n"
        f"- Plain text only — no markdown, no asterisks, no headers\n"
        f"- Do NOT include the complexity label in your response\n"
        f"- Only include bullet points that add meaningful information\n"
    )

    try:
        response = call_claude(prompt, temperature=0.1, max_tokens=512)

        # Guardrail: ported as-is from original llm_service.py
        refusal_keywords = ["not complete", "cannot provide", "provide the sql", "sorry"]
        if any(word in response.lower() for word in refusal_keywords):
            return (
                "TalkToData Engine: This query performs a structured data retrieval "
                "involving selection, joining, and ordering of records based on the current schema."
            )

        return response.strip()
    except Exception as exc:
        logger.error(f"Explanation generation failed: {exc}")
        return "Unable to generate explanation."


def review_sql(question: str, schema: str, generated_sql: str, dialect: str = "sqlite") -> str:
    """
    Silent second-pass SQL reviewer. Returns the final correct SQL.
    Users never see this step — it runs internally and returns only the corrected SQL.
    """
    prompt = (
        f"### ROLE\n"
        f"You are a senior SQL analyst performing a strict code review. "
        f"Your job is to verify that a generated SQL query correctly and completely answers the user's question.\n\n"
        f"### USER'S ORIGINAL QUESTION\n{question}\n\n"
        f"### DATABASE SCHEMA\n{schema}\n\n"
        f"### SQL TO REVIEW\n{generated_sql}\n\n"
        f"### REVIEW CHECKLIST — check every item:\n"
        f"1. Does the SQL actually answer what the user asked? (semantic correctness)\n"
        f"2. Are the correct tables joined? Are join conditions correct? No Cartesian products?\n"
        f"3. For 'most', 'highest', 'maximum', 'least' — is it using proper aggregation? Not just LIMIT 1?\n"
        f"4. Are CTEs complete and correctly referenced? No missing WITH clauses?\n"
        f"5. Is GROUP BY correct — all non-aggregated columns included?\n"
        f"6. Are WHERE conditions correct for the question asked?\n"
        f"7. Is the dialect correct for {dialect}?\n"
        f"8. Would this query actually run without errors?\n\n"
        f"### OUTPUT FORMAT\n"
        f"Respond ONLY with valid JSON. No markdown. No explanation outside the JSON.\n"
        f"Escape newlines inside the SQL string as \\n so the JSON stays valid.\n"
        f"{{\n"
        f'  "sql": "the final correct SQL — either unchanged if correct, or your corrected version if issues found"\n'
        f"}}\n"
    )
    try:
        raw = call_claude(
            prompt=prompt,
            temperature=0.0,
            max_tokens=2000,
        )
        raw = re.sub(r'```(?:json)?\s*', '', raw, flags=re.IGNORECASE).strip()
        result = json.loads(raw)
        corrected = str(result.get("sql") or "").strip()
        if corrected:
            return corrected
        return generated_sql
    except Exception as e:
        logger.error(f"SQL review failed silently, using original: {e}")
        return generated_sql


def clean_sql_output(raw: str) -> str:
    """
    Strip markdown fences and surrounding prose, keep only the SQL.
    Keeps everything from the first statement keyword onward so multi-line
    CTEs are never truncated (inner lines of a WITH block start with SELECT).
    """
    raw = re.sub(r'```(?:sql)?\s*', '', raw, flags=re.IGNORECASE).strip()
    # Take everything from the first line that starts a SQL statement…
    match = re.search(
        r'^\s*(WITH|SELECT|INSERT|UPDATE|DELETE|CREATE)\b',
        raw,
        re.IGNORECASE | re.MULTILINE,
    )
    sql = raw[match.start():] if match else raw
    # …and drop trailing prose after the last semicolon when one exists.
    if ';' in sql:
        sql = sql[: sql.rindex(';') + 1]
    return sql.strip()
