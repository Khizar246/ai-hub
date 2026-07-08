# APIRouter for TalkToData Engine — endpoints ported from Talk_To_Data_Engine/backend/main.py.
# Session state stored in Redis via session_manager instead of the original global dict.

import asyncio
import re
from typing import Annotated

from fastapi import APIRouter, File, Header, HTTPException, Request, UploadFile

from agents.data import db_connector, llm_service, transpiler
from agents.data.db_connector import get_connector
from agents.data.schemas import (
    AskRequest,
    AskResponse,
    ExecutionRequest,
    ExecutionResponse,
    FinalSchemaRequest,
    PostgresConfig,
    PostgresMetadataRequest,
    TableReview,
)
from core import crypto, telemetry
from core.config import settings
from core.exceptions import AgentError, DatabaseConnectionError
from core.logger import get_logger
from core.session_manager import session_manager

logger = get_logger(__name__)

router = APIRouter()

# Redis key suffixes for session-scoped state
_SCHEMA_KEY = "data:schema_text"
_DIALECT_KEY = "data:dialect"
_PG_CONFIG_KEY = "data:pg_config"

# Data-agent session state lives longer than the 1h default so a working
# session doesn't silently lose its schema mid-conversation.
_SESSION_TTL = 24 * 3600

# Session IDs are used in Redis keys and file paths — enforce a safe format.
_SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")

# Stored dialect → dialect name used for SQL generation prompts
_SQL_DIALECT_MAP = {
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "mysql": "mysql",
    "mssql": "tsql",
    "sqlite": "sqlite",
}


def _require_session(x_session_id: str | None) -> str:
    if not x_session_id:
        raise HTTPException(status_code=400, detail="X-Session-ID header is required.")
    if not _SESSION_ID_RE.fullmatch(x_session_id):
        raise HTTPException(status_code=400, detail="Invalid X-Session-ID format.")
    return x_session_id


async def _load_session_config(session_id: str) -> PostgresConfig | None:
    """Read + decrypt the stored server-DB config; None when absent/undecryptable."""
    raw = await session_manager.get(session_id, _PG_CONFIG_KEY)
    data = crypto.decrypt_json(raw)
    return PostgresConfig(**data) if data else None


# ---------------------------------------------------------------------------
# /parse-excel
# ---------------------------------------------------------------------------

@router.post("/parse-excel")
async def parse_excel(
    file: Annotated[UploadFile, File(...)],
    x_session_id: Annotated[str | None, Header()] = None,
) -> dict:
    """Upload Excel/CSV file, write tables to session SQLite DB, return table metadata."""
    session_id = _require_session(x_session_id)
    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File too large — the limit is {settings.MAX_UPLOAD_MB} MB.",
        )
    try:
        tables = await asyncio.to_thread(
            db_connector.parse_excel_to_sqlite, contents, session_id, file.filename or ""
        )
        # A fresh file upload means this session is now SQLite — drop any
        # leftover server-DB config so /ask can't generate the wrong dialect.
        await session_manager.delete(session_id, _PG_CONFIG_KEY)
        await session_manager.set(session_id, _DIALECT_KEY, "sqlite", ttl=_SESSION_TTL)
        return {"tables": tables}
    except Exception as exc:
        logger.error(f"File parsing failed for session {session_id}: {exc}")
        raise HTTPException(
            status_code=400,
            detail="Could not parse the uploaded file. Supported formats: .xlsx, .xls, .csv.",
        ) from exc


# ---------------------------------------------------------------------------
# /list-postgres-tables
# ---------------------------------------------------------------------------

@router.post("/list-postgres-tables")
async def list_postgres_tables(
    raw_request: Request,
    x_session_id: Annotated[str | None, Header()] = None,
) -> dict:
    """Connect to the database server and return all table names."""
    body = await raw_request.json()
    try:
        config = PostgresConfig(**body)
    except Exception as exc:
        logger.info(f"list_postgres_tables_validation_error={exc}")
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    session_id = _require_session(x_session_id)
    try:
        connector = get_connector(config)
        tables = await asyncio.to_thread(connector.list_tables)
        # Credentials are encrypted at rest — Redis never sees the plaintext password.
        await session_manager.set(
            session_id, _PG_CONFIG_KEY, crypto.encrypt_json(config.model_dump()), ttl=_SESSION_TTL
        )
        await session_manager.set(session_id, _DIALECT_KEY, config.db_type, ttl=_SESSION_TTL)
        return {"tables": tables}
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# /fetch-postgres-metadata
# ---------------------------------------------------------------------------

@router.post("/fetch-postgres-metadata")
async def fetch_postgres_metadata(
    request: PostgresMetadataRequest,
    x_session_id: Annotated[str | None, Header()] = None,
) -> dict:
    """Fetch column info for the selected tables."""
    _require_session(x_session_id)
    try:
        connector = get_connector(request.config)
        raw = await asyncio.to_thread(connector.fetch_metadata, request.selected_tables)
        tables = [
            {
                "table_name": item["table"],
                "columns": [
                    {"name": c["name"], "data_type": str(c["type"]).upper(), "description": ""}
                    for c in item["columns"]
                ],
            }
            for item in raw
        ]
        return {"tables": tables}
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# /finalize-metadata
# ---------------------------------------------------------------------------

def _truncate_cell(value: object, max_len: int = 60) -> str:
    text = str(value) if value is not None else ""
    return text if len(text) <= max_len else text[: max_len - 1] + "…"


def _build_samples_text(
    tables: list[TableReview],
    dialect: str,
    config: PostgresConfig | None,
    session_id: str,
) -> str:
    """Fetch up to 3 sample rows per table so the LLM sees real value formats."""
    parts = []
    for table in tables[:10]:
        try:
            result = db_connector.fetch_sample_rows(
                table.table_name, dialect, config, session_id
            )
        except Exception as exc:
            logger.warning(f"Sample fetch skipped for {table.table_name}: {exc}")
            continue
        if not result["rows"]:
            continue
        header = " | ".join(str(c) for c in result["columns"])
        lines = [" | ".join(_truncate_cell(v) for v in row) for row in result["rows"]]
        parts.append(f"{table.table_name}:\n{header}\n" + "\n".join(lines))
    return "\n\n".join(parts)


@router.post("/finalize-metadata")
async def finalize_metadata(
    data: FinalSchemaRequest,
    x_session_id: Annotated[str | None, Header()] = None,
) -> dict:
    """Build schema text (with descriptions + sample rows) and store it for LLM queries."""
    session_id = _require_session(x_session_id)

    schema_parts = []
    for table in data.tables:
        col_lines = []
        for c in table.columns:
            line = f"  - {c.name} ({c.data_type})"
            if c.description.strip():
                line += f": {c.description.strip()}"
            col_lines.append(line)
        schema_parts.append(f"Table: {table.table_name}\nColumns:\n" + "\n".join(col_lines))
    schema_text = "\n\n".join(schema_parts)

    # Enrich the schema with real sample rows — dramatically improves SQL
    # accuracy (value formats, date styles, category spellings). Best-effort:
    # any failure just means no samples.
    config: PostgresConfig | None = None
    if data.dialect != "sqlite":
        config = await _load_session_config(session_id)
    samples_text = await asyncio.to_thread(
        _build_samples_text, data.tables, data.dialect, config, session_id
    )
    if samples_text:
        schema_text += "\n\n### SAMPLE DATA (first rows per table)\n" + samples_text

    await session_manager.set(session_id, _SCHEMA_KEY, schema_text, ttl=_SESSION_TTL)
    await session_manager.set(session_id, _DIALECT_KEY, data.dialect, ttl=_SESSION_TTL)
    return {"status": "Metadata locked"}


# ---------------------------------------------------------------------------
# /ask
# ---------------------------------------------------------------------------

@router.post("/ask", response_model=AskResponse)
async def ask(
    payload: AskRequest,
    x_session_id: Annotated[str | None, Header()] = None,
) -> AskResponse:
    """Generate SQL + explanation for a natural language question."""
    session_id = _require_session(x_session_id)
    schema_text: str | None = await session_manager.get(session_id, _SCHEMA_KEY)
    dialect: str = (await session_manager.get(session_id, _DIALECT_KEY)) or "sqlite"

    if not schema_text:
        raise HTTPException(
            status_code=400,
            detail="Schema not initialised. Upload data or connect a database first.",
        )

    # The stored dialect is the source of truth (set on upload/connect),
    # so SQL generation, review, and validation all use the same dialect.
    sql_dialect = _SQL_DIALECT_MAP.get(dialect, "sqlite")

    try:
        # Step 1: Generate SQL (blocking SDK call — run off the event loop)
        cleaned_sql = await asyncio.to_thread(
            llm_service.get_sql, schema_text, payload.question, sql_dialect
        )

        # Step 2: Silent SQL review — corrects errors internally, users never see this step
        reviewed_sql = await asyncio.to_thread(
            llm_service.review_sql,
            payload.question,
            schema_text,
            cleaned_sql,
            sql_dialect,
        )

        # Step 3: SQLGlot structural validation + pretty formatting
        validated_sql = transpiler.validate_and_format_sql(reviewed_sql, sql_dialect)
    except AgentError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Step 4: Get explanation
    explanation = await asyncio.to_thread(llm_service.get_explanation, validated_sql)
    clean_logic = transpiler.clean_explanation(explanation)

    return AskResponse(sql=validated_sql, explanation=clean_logic, dialect=dialect)


# ---------------------------------------------------------------------------
# /execute
# ---------------------------------------------------------------------------

@router.post("/execute", response_model=ExecutionResponse)
async def execute_query(
    req: ExecutionRequest,
    x_session_id: Annotated[str | None, Header()] = None,
) -> ExecutionResponse:
    """Execute SQL against the connected database and return rows + hero card data."""
    session_id = _require_session(x_session_id)

    # Generated or hand-edited SQL must never mutate the connected database.
    try:
        transpiler.assert_read_only(req.query, req.dialect)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Resolve server-DB config: prefer request body, fall back to session
    config = req.config
    if req.dialect in ("postgres", "postgresql", "mysql", "mssql") and config is None:
        config = await _load_session_config(session_id)

    try:
        result = await asyncio.to_thread(
            db_connector.execute_sql, req.query, req.dialect, config, session_id
        )
    except DatabaseConnectionError as exc:
        await asyncio.to_thread(telemetry.record_sql_execution, False)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        await asyncio.to_thread(telemetry.record_sql_execution, False)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await asyncio.to_thread(telemetry.record_sql_execution, True)
    return ExecutionResponse(**result)
