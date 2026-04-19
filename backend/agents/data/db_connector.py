# PostgreSQL and SQLite connection logic — ported from Talk_To_Data_Engine/backend/main.py

import io
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


def _sqlite_db_path(session_id: str) -> str:
    """Return the session-scoped SQLite DB path, ensuring the directory exists."""
    path = Path(settings.UPLOADS_PATH) / f"{session_id}_data.db"
    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


def connect_postgres(config: PostgresConfig) -> psycopg2.extensions.connection:
    """Open and return a psycopg2 connection; raises DatabaseConnectionError on failure."""
    try:
        return psycopg2.connect(
            host=config.host,
            port=config.port,
            database=config.database,
            user=config.username,
            password=config.password,
        )
    except Exception as exc:
        raise DatabaseConnectionError(f"Postgres connection failed: {exc}") from exc


def list_postgres_tables(config: PostgresConfig) -> list[str]:
    """Return all public table names in the connected Postgres database."""
    conn = connect_postgres(config)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
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
                WHERE table_name = %s
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
            rows = [dict(zip(columns, row)) for row in cur.fetchall()]
            return {"columns": columns, "rows": rows}
        finally:
            conn.close()


class MySQLConnector:
    def __init__(self, config: PostgresConfig):
        self.config = config

    def get_connection(self):
        import mysql.connector
        ssl_args = {"ssl_disabled": not self.config.ssl_required}
        return mysql.connector.connect(
            host=self.config.host,
            port=int(self.config.port),
            database=self.config.database,
            user=self.config.username,
            password=self.config.password,
            **ssl_args,
        )

    def list_tables(self) -> list[str]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return tables

    def fetch_metadata(self, tables: list[str]) -> list[dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        metadata = []
        for table in tables:
            cursor.execute(f"DESCRIBE `{table}`")
            columns = [{"name": row[0], "type": row[1]} for row in cursor.fetchall()]
            cursor.execute(f"SELECT * FROM `{table}` LIMIT 3")
            samples = cursor.fetchall()
            metadata.append({"table": table, "columns": columns, "samples": samples})
        cursor.close()
        conn.close()
        return metadata

    def execute_query(self, sql: str) -> dict:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(sql)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return {"columns": columns, "rows": rows}


class MSSQLConnector:
    def __init__(self, config: PostgresConfig):
        self.config = config

    def _get_connection_string(self) -> str:
        trust_cert = "no" if self.config.ssl_required else "yes"
        return (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={self.config.host},{self.config.port};"
            f"DATABASE={self.config.database};"
            f"UID={self.config.username};"
            f"PWD={self.config.password};"
            f"TrustServerCertificate={trust_cert};"
        )

    def get_connection(self):
        import pyodbc
        return pyodbc.connect(self._get_connection_string())

    def list_tables(self) -> list[str]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        """)
        tables = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return tables

    def fetch_metadata(self, tables: list[str]) -> list[dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        metadata = []
        for table in tables:
            cursor.execute(f"""
                SELECT COLUMN_NAME, DATA_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = '{table}'
            """)
            columns = [{"name": row[0], "type": row[1]} for row in cursor.fetchall()]
            cursor.execute(f"SELECT TOP 3 * FROM [{table}]")
            samples = cursor.fetchall()
            metadata.append({"table": table, "columns": columns, "samples": samples})
        cursor.close()
        conn.close()
        return metadata

    def execute_query(self, sql: str) -> dict:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(sql)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return {"columns": columns, "rows": rows}


def get_connector(config: PostgresConfig):
    if config.db_type == "mysql":
        return MySQLConnector(config)
    elif config.db_type == "mssql":
        return MSSQLConnector(config)
    else:
        return PostgreSQLConnector(config)


def parse_excel_to_sqlite(file_bytes: bytes, session_id: str) -> list[dict[str, Any]]:
    """
    Load Excel bytes into a session-scoped SQLite DB and infer SQL column types.
    Returns list of table metadata dicts ready for the schema review UI.
    """
    db_path = _sqlite_db_path(session_id)
    xl = pd.ExcelFile(io.BytesIO(file_bytes))
    conn = sqlite3.connect(db_path)
    all_tables: list[dict[str, Any]] = []
    try:
        for sheet in xl.sheet_names:
            df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sheet)
            safe_name = sheet.replace(" ", "_").lower()
            df.to_sql(safe_name, conn, if_exists="replace", index=False)

            cols = []
            for col in df.columns:
                dtype = str(df[col].dtype).upper()
                sql_type = (
                    "BIGINT" if "INT" in dtype
                    else "DECIMAL" if "FLOAT" in dtype
                    else "TEXT"
                )
                cols.append({"name": col, "data_type": sql_type, "description": ""})

            all_tables.append({"table_name": safe_name, "columns": cols})
    finally:
        conn.close()

    logger.info(f"Parsed {len(all_tables)} sheets into SQLite for session {session_id}")
    return all_tables


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
        rows_dicts = result["rows"]
        rows = [[row.get(col) for col in columns] for row in rows_dicts]
        hero_data = {columns[i]: rows[0][i] for i in range(len(columns))} if len(rows) == 1 else None
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
