# SQL generation and explanation prompts ported EXACTLY from Talk_To_Data_Engine/backend/app/services/llm_service.py.
# Only change: Ollama HTTP call replaced with core/llm_client.call_claude().

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
        "industry-standard PostgreSQL" if dialect == "postgres"
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
        f"4. SINGLE TABLE RULE:\n"
        f"   - If the schema contains only one table, assume a denormalized structure.\n"
        f"   - Include descriptive columns in GROUP BY when aggregating.\n"
        f"5. TIES AND RANKING:\n"
        f"   - Prefer MAX()/MIN() subqueries or RANK() over LIMIT 1.\n"
        f"   - If using SQLite: Do NOT use ROW_NUMBER().\n"
        f"6. CTEs: Prefer WITH clauses (Common Table Expressions) for clarity in all complex logic.\n"
        f"7. OUTPUT: Return ONLY raw SQL. No markdown, no backticks, no preamble, no explanation.\n\n"
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
        return _clean_sql(response)
    except Exception as exc:
        logger.error(f"SQL generation failed: {exc}")
        raise AgentError(f"SQL generation failed: {exc}") from exc


def get_explanation(query: str) -> str:
    """
    Generate a two-sentence technical explanation of the SQL query (prompt ported as-is).
    Includes the refusal guardrail from the original llm_service.py.
    """
    prompt = (
        f"Analyze the provided SQL query and explain its technical logic in exactly two concise sentences. "
        f"Constraint: Only describe operations explicitly present in the code (SELECT, JOIN, GROUP BY, etc.). "
        f"Avoid any introductory fluff or definitions of SQL terms.\n\n"
        f"SQL: {query}\n\n"
        f"Technical Explanation:"
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


def _clean_sql(sql: str) -> str:
    """
    Remove markdown formatting and trim to the first SQL statement.
    Ported as-is from original LLMService._clean_sql().
    """
    cleaned = sql.replace("```sql", "").replace("```", "").strip()
    upper = cleaned.upper()
    start_idx = -1
    for keyword in ["SELECT", "WITH", "SHOW"]:
        idx = upper.find(keyword)
        if idx != -1 and (start_idx == -1 or idx < start_idx):
            start_idx = idx
    if start_idx != -1:
        cleaned = cleaned[start_idx:]
    if ";" in cleaned:
        cleaned = cleaned.split(";")[0] + ";"
    return cleaned
