# PostgreSQL / MySQL / MSSQL / SQLite connection logic — ported from
# Talk_To_Data_Engine/backend/main.py, hardened for identifier safety,
# connection cleanup, SSL, and CSV/.xls uploads.

import io
import re
import sqlite3
from pathlib import Path
from typing import Any

import pandas as pd
import psycopg2
import psycopg2.extensions

from agents.data.schemas import PostgresConfig
from core.config import settings
from core.exceptions import DatabaseConnectionError
from core.logger import get_logger

logger = get_logger(__name__)

# Session IDs come from a client-controlled header and end up in file paths —
# restrict to a safe charset so "../" can never escape the uploads directory.
_SAFE_SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _sqlite_db_path(session_id: str) -> str:
    """Return the session-scoped SQLite DB path, ensuring the directory exists."""
    if not _SAFE_SESSION_RE.fullmatch(session_id):
        raise DatabaseConnectionError("Invalid session identifier.")
    path = Path(settings.UPLOADS_PATH) / f"{session_id}_data.db"
    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


def quote_identifier(name: str, dialect: str) -> str:
    """Quote a table/column identifier safely for the given dialect."""
    if dialect == "mysql":
        return "`" + name.replace("`", "``") + "`"
    if dialect in ("mssql", "tsql"):
        return "[" + name.replace("]", "]]") + "]"
    # sqlite / postgres share double-quote style
    return '"' + name.replace('"', '""') + '"'


# User-supplied databases can be slow or unreachable — bound both the connect
# and each statement so one bad query can't pin a worker thread indefinitely.
_CONNECT_TIMEOUT_S = 10
_QUERY_TIMEOUT_MS = 30_000


def connect_postgres(config: PostgresConfig) -> psycopg2.extensions.connection:
    """Open and return a psycopg2 connection; raises DatabaseConnectionError on failure."""
    try:
        return psycopg2.connect(
            host=config.host,
            port=config.port,
            database=config.database,
            user=config.username,
            password=config.password,
            sslmode="require" if config.ssl_required else "prefer",
            connect_timeout=_CONNECT_TIMEOUT_S,
            options=f"-c statement_timeout={_QUERY_TIMEOUT_MS}",
        )
    except Exception as exc:
        raise DatabaseConnectionError(f"Postgres connection failed: {exc}") from exc


def list_postgres_tables(config: PostgresConfig) -> list[str]:
    """Return all public table names in the connected Postgres database."""
    conn = connect_postgres(config)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        )
        return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def fetch_postgres_metadata(
    config: PostgresConfig, selected_tables: list[str]
) -> list[dict[str, Any]]:
    """Return column names and inferred types for the requested Postgres tables."""
    conn = connect_postgres(config)
    try:
        cur = conn.cursor()
        tables_metadata: list[dict[str, Any]] = []
        for table in selected_tables:
            cur.execute(
                """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
                """,
                (table,),
            )
            cols = [
                {"name": r[0], "data_type": r[1].upper(), "description": ""}
                for r in cur.fetchall()
            ]
            tables_metadata.append({"table_name": table, "columns": cols})
        return tables_metadata
    finally:
        conn.close()


class PostgreSQLConnector:
    def __init__(self, config: PostgresConfig):
        self.config = config

    def list_tables(self) -> list[str]:
        return list_postgres_tables(self.config)

    def fetch_metadata(self, tables: list[str]) -> list[dict]:
        raw = fetch_postgres_metadata(self.config, tables)
        return [
            {
                "table": item["table_name"],
                "columns": [{"name": c["name"], "type": c["data_type"]} for c in item["columns"]],
                "samples": [],
            }
            for item in raw
        ]

    def execute_query(self, sql: str) -> dict:
        conn = connect_postgres(self.config)
        try:
            cur = conn.cursor()
            cur.execute(sql)
            columns = [desc[0] for desc in cur.description] if cur.description else []
            rows = [list(row) for row in cur.fetchall()]
            return {"columns": columns, "rows": rows}
        finally:
            conn.close()


class MySQLConnector:
    def __init__(self, config: PostgresConfig):
        self.config = config

    def get_connection(self):
        import mysql.connector
        ssl_args = {"ssl_disabled": not self.config.ssl_required}
        try:
            conn = mysql.connector.connect(
                host=self.config.host,
                port=int(self.config.port),
                database=self.config.database,
                user=self.config.username,
                password=self.config.password,
                connection_timeout=_CONNECT_TIMEOUT_S,
                **ssl_args,
            )
        except Exception as exc:
            raise DatabaseConnectionError(f"MySQL connection failed: {exc}") from exc
        try:
            # SELECT-statement timeout (MySQL 5.7.8+); ignored where unsupported (MariaDB)
            cursor = conn.cursor()
            cursor.execute(f"SET SESSION MAX_EXECUTION_TIME={_QUERY_TIMEOUT_MS}")
            cursor.close()
        except Exception:
            pass
        return conn

    def list_tables(self) -> list[str]:
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SHOW TABLES")
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()

    def fetch_metadata(self, tables: list[str]) -> list[dict]:
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            metadata = []
            for table in tables:
                ident = quote_identifier(table, "mysql")
                cursor.execute(f"DESCRIBE {ident}")
                columns = [{"name": row[0], "type": row[1]} for row in cursor.fetchall()]
                cursor.execute(f"SELECT * FROM {ident} LIMIT 3")
                samples = [list(row) for row in cursor.fetchall()]
                metadata.append({"table": table, "columns": columns, "samples": samples})
            return metadata
        finally:
            conn.close()

    def execute_query(self, sql: str) -> dict:
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(sql)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = [list(row) for row in cursor.fetchall()]
            return {"columns": columns, "rows": rows}
        finally:
            conn.close()


class MSSQLConnector:
    def __init__(self, config: PostgresConfig):
        self.config = config

    def _get_connection_string(self) -> str:
        # ssl_required must actually force encryption, not just certificate trust
        encryption = (
            "Encrypt=yes;TrustServerCertificate=no;"
            if self.config.ssl_required
            else "Encrypt=no;TrustServerCertificate=yes;"
        )
        return (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={self.config.host},{self.config.port};"
            f"DATABASE={self.config.database};"
            f"UID={self.config.username};"
            f"PWD={self.config.password};"
            f"{encryption}"
        )

    def get_connection(self):
        import pyodbc
        try:
            conn = pyodbc.connect(self._get_connection_string(), timeout=_CONNECT_TIMEOUT_S)
            conn.timeout = _QUERY_TIMEOUT_MS // 1000  # per-query timeout in seconds
            return conn
        except Exception as exc:
            raise DatabaseConnectionError(f"SQL Server connection failed: {exc}") from exc

    def list_tables(self) -> list[str]:
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES "
                "WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
            )
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()

    def fetch_metadata(self, tables: list[str]) -> list[dict]:
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            metadata = []
            for table in tables:
                cursor.execute(
                    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                    "WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
                    (table,),
                )
                columns = [{"name": row[0], "type": row[1]} for row in cursor.fetchall()]
                ident = quote_identifier(table, "mssql")
                cursor.execute(f"SELECT TOP 3 * FROM {ident}")
                samples = [list(row) for row in cursor.fetchall()]
                metadata.append({"table": table, "columns": columns, "samples": samples})
            return metadata
        finally:
            conn.close()

    def execute_query(self, sql: str) -> dict:
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(sql)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = [list(row) for row in cursor.fetchall()]
            return {"columns": columns, "rows": rows}
        finally:
            conn.close()


def get_connector(config: PostgresConfig):
    if config.db_type == "mysql":
        return MySQLConnector(config)
    elif config.db_type == "mssql":
        return MSSQLConnector(config)
    else:
        return PostgreSQLConnector(config)


def _sanitize_identifier(name: str, fallback: str = "unnamed") -> str:
    """Make a name safe to use unquoted in SQL: alphanumerics + underscores only."""
    safe = re.sub(r"[^0-9a-zA-Z_]+", "_", str(name).strip()).strip("_")
    if not safe:
        safe = fallback
    if safe[0].isdigit():
        safe = f"t_{safe}"
    return safe


def _dedupe_names(names: list[str]) -> list[str]:
    """Suffix duplicate names (_2, _3, …) so no table/column silently overwrites another."""
    seen: dict[str, int] = {}
    result = []
    for name in names:
        key = name.lower()
        if key in seen:
            seen[key] += 1
            result.append(f"{name}_{seen[key]}")
        else:
            seen[key] = 1
            result.append(name)
    return result


def _sql_type_for(dtype: str) -> str:
    d = dtype.upper()
    if "BOOL" in d:
        return "BOOLEAN"
    if "DATETIME" in d or "DATE" in d:
        return "TIMESTAMP"
    if "INT" in d:
        return "BIGINT"
    if "FLOAT" in d or "DECIMAL" in d:
        return "DECIMAL"
    return "TEXT"


def parse_excel_to_sqlite(
    file_bytes: bytes, session_id: str, filename: str = ""
) -> list[dict[str, Any]]:
    """
    Load Excel (.xlsx/.xls) or CSV bytes into a session-scoped SQLite DB.
    Table and column names are sanitized so generated SQL can reference them
    unquoted; duplicates get numeric suffixes instead of overwriting each other.
    Returns list of table metadata dicts ready for the schema review UI.
    """
    is_csv = filename.lower().endswith(".csv")
    if is_csv:
        table_name = _sanitize_identifier(Path(filename).stem.lower(), fallback="data")
        frames = {table_name: pd.read_csv(io.BytesIO(file_bytes))}
    else:
        xl = pd.ExcelFile(io.BytesIO(file_bytes))
        sheet_names = _dedupe_names(
            [_sanitize_identifier(s.lower(), fallback="sheet") for s in xl.sheet_names]
        )
        frames = {
            safe: xl.parse(original)
            for safe, original in zip(sheet_names, xl.sheet_names)
        }

    db_path = _sqlite_db_path(session_id)
    conn = sqlite3.connect(db_path)
    all_tables: list[dict[str, Any]] = []
    try:
        for table_name, df in frames.items():
            df.columns = _dedupe_names(
                [_sanitize_identifier(c, fallback="column") for c in df.columns]
            )
            df.to_sql(table_name, conn, if_exists="replace", index=False)

            cols = [
                {"name": col, "data_type": _sql_type_for(str(df[col].dtype)), "description": ""}
                for col in df.columns
            ]
            all_tables.append({"table_name": table_name, "columns": cols})
    finally:
        conn.close()

    logger.info(f"Parsed {len(all_tables)} table(s) into SQLite for session {session_id}")
    return all_tables


def fetch_sample_rows(
    table: str,
    dialect: str,
    config: PostgresConfig | None = None,
    session_id: str = "",
    limit: int = 3,
) -> dict[str, Any]:
    """Fetch a few sample rows from a table — used to enrich the LLM schema context."""
    ident = quote_identifier(table, dialect)
    if dialect in ("mssql", "tsql"):
        query = f"SELECT TOP {int(limit)} * FROM {ident}"
    else:
        query = f"SELECT * FROM {ident} LIMIT {int(limit)}"
    return execute_sql(query, dialect, config, session_id)


def execute_sql(
    query: str,
    dialect: str,
    config: PostgresConfig | None = None,
    session_id: str = "",
) -> dict[str, Any]:
    """
    Execute query against the appropriate database.
    Returns columns, rows, and hero_data (populated when exactly 1 row is returned).
    """
    if dialect in ("mysql", "mssql"):
        if not config:
            raise DatabaseConnectionError("No database configuration provided.")
        connector = get_connector(config)
        result = connector.execute_query(query)
        columns = result["columns"]
        rows = result["rows"]
        hero_data = dict(zip(columns, rows[0])) if len(rows) == 1 else None
        return {"columns": columns, "rows": rows, "hero_data": hero_data}

    if dialect in ("postgres", "postgresql"):
        if not config:
            raise DatabaseConnectionError("No Postgres configuration provided.")
        conn: psycopg2.extensions.connection | sqlite3.Connection = connect_postgres(config)
    else:
        db_path = _sqlite_db_path(session_id) if session_id else "./storage/data.db"
        conn = sqlite3.connect(db_path)

    try:
        cur = conn.cursor()
        cur.execute(query)

        if cur.description:
            columns = [desc[0] for desc in cur.description]
            rows = [list(row) for row in cur.fetchall()]

            # HERO LOGIC: exactly 1 row returned → populate hero card data
            hero_data = None
            if len(rows) == 1:
                hero_data = {columns[i]: rows[0][i] for i in range(len(columns))}

            return {"columns": columns, "rows": rows, "hero_data": hero_data}
        else:
            conn.commit()  # type: ignore[union-attr]
            return {"columns": ["Status"], "rows": [["Operation Successful"]], "hero_data": None}
    finally:
        conn.close()
