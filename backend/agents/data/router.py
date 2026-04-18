# APIRouter for TalkToData Engine — endpoints ported from Talk_To_Data_Engine/backend/main.py.
# Session state stored in Redis via session_manager instead of the original global dict.

from typing import Annotated, Optional

from fastapi import APIRouter, File, Header, HTTPException, Request, UploadFile

from agents.data import db_connector, llm_service, transpiler
from agents.data.schemas import (
    AskRequest,
    ExecutionRequest,
    FinalSchemaRequest,
    PostgresConfig,
    PostgresMetadataRequest,
)
from core.exceptions import AgentError, DatabaseConnectionError
from core.logger import get_logger
from core.session_manager import session_manager

logger = get_logger(__name__)

router = APIRouter()

# Redis key suffixes for session-scoped state
_SCHEMA_KEY = "data:schema_text"
_DIALECT_KEY = "data:dialect"
_PG_CONFIG_KEY = "data:pg_config"


def _require_session(x_session_id: Optional[str]) -> str:
    if not x_session_id:
        raise HTTPException(status_code=400, detail="X-Session-ID header is required.")
    return x_session_id


# ---------------------------------------------------------------------------
# /parse-excel
# ---------------------------------------------------------------------------

@router.post("/parse-excel")
async def parse_excel(
    file: Annotated[UploadFile, File(...)],
    x_session_id: Annotated[Optional[str], Header()] = None,
) -> dict:
    """Upload Excel file, write sheets to session SQLite DB, return table metadata."""
    session_id = _require_session(x_session_id)
    try:
        contents = await file.read()
        tables = db_connector.parse_excel_to_sqlite(contents, session_id)
        await session_manager.set(session_id, _DIALECT_KEY, "sqlite")
        return {"tables": tables}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Excel parsing error: {exc}") from exc


# ---------------------------------------------------------------------------
# /list-postgres-tables
# ---------------------------------------------------------------------------

@router.post("/list-postgres-tables")
async def list_postgres_tables(
    raw_request: Request,
    x_session_id: Annotated[Optional[str], Header()] = None,
) -> dict:
    """Connect to Postgres and return all public table names."""
    body = await raw_request.json()
    logger.info(f"list_postgres_tables_raw_body={body}")
    try:
        config = PostgresConfig(**body)
    except Exception as exc:
        logger.info(f"list_postgres_tables_validation_error={exc}")
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    session_id = _require_session(x_session_id)
    try:
        tables = db_connector.list_postgres_tables(config)
        await session_manager.set(session_id, _PG_CONFIG_KEY, config.model_dump())
        await session_manager.set(session_id, _DIALECT_KEY, "postgres")
        return {"tables": tables}
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# /fetch-postgres-metadata
# ---------------------------------------------------------------------------

@router.post("/fetch-postgres-metadata")
async def fetch_postgres_metadata(
    request: PostgresMetadataRequest,
    x_session_id: Annotated[Optional[str], Header()] = None,
) -> dict:
    """Fetch column info for the selected Postgres tables."""
    _require_session(x_session_id)
    try:
        tables = db_connector.fetch_postgres_metadata(
            request.config, request.selected_tables
        )
        return {"tables": tables}
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# /finalize-metadata
# ---------------------------------------------------------------------------

@router.post("/finalize-metadata")
async def finalize_metadata(
    data: FinalSchemaRequest,
    x_session_id: Annotated[Optional[str], Header()] = None,
) -> dict:
    """Build schema text from reviewed tables and store in session for LLM queries."""
    session_id = _require_session(x_session_id)
    schema_parts = []
    for table in data.tables:
        col_defs = [f"{c.name} ({c.data_type})" for c in table.columns]
        schema_parts.append(f"Table: {table.table_name} | Columns: {', '.join(col_defs)}")

    await session_manager.set(session_id, _SCHEMA_KEY, "\n".join(schema_parts))
    await session_manager.set(session_id, _DIALECT_KEY, data.dialect)
    return {"status": "Metadata locked"}


# ---------------------------------------------------------------------------
# /ask
# ---------------------------------------------------------------------------

@router.post("/ask")
async def ask(
    payload: AskRequest,
    x_session_id: Annotated[Optional[str], Header()] = None,
) -> dict:
    """Generate SQL + explanation for a natural language question."""
    session_id = _require_session(x_session_id)
    schema_text: str | None = await session_manager.get(session_id, _SCHEMA_KEY)
    dialect: str = (await session_manager.get(session_id, _DIALECT_KEY)) or "sqlite"

    if not schema_text:
        raise HTTPException(
            status_code=400,
            detail="Schema not initialised. Upload data or connect a database first.",
        )

    try:
        raw_sql = llm_service.get_sql(schema_text, payload.question, dialect)
        validated_sql = transpiler.validate_and_format_sql(raw_sql, dialect)
    except AgentError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    explanation = llm_service.get_explanation(validated_sql)
    clean_logic = transpiler.clean_explanation(explanation)

    return {"sql": validated_sql, "explanation": clean_logic, "dialect": dialect}


# ---------------------------------------------------------------------------
# /execute
# ---------------------------------------------------------------------------

@router.post("/execute")
async def execute_query(
    req: ExecutionRequest,
    x_session_id: Annotated[Optional[str], Header()] = None,
) -> dict:
    """Execute SQL against the connected database and return rows + hero card data."""
    session_id = _require_session(x_session_id)

    # Resolve Postgres config: prefer request body, fall back to session
    config = req.config
    if req.dialect == "postgres" and config is None:
        pg_config_data = await session_manager.get(session_id, _PG_CONFIG_KEY)
        if pg_config_data:
            config = PostgresConfig(**pg_config_data)

    try:
        result = db_connector.execute_sql(req.query, req.dialect, config, session_id)
        return result
    except DatabaseConnectionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
