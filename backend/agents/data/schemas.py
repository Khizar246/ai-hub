# Pydantic request/response models for TalkToData Engine — ported from Talk_To_Data_Engine/backend/main.py

from typing import Any, Optional

from pydantic import BaseModel


class ColumnReview(BaseModel):
    name: str
    data_type: str
    description: Optional[str] = ""


class TableReview(BaseModel):
    table_name: str
    columns: list[ColumnReview]


class FinalSchemaRequest(BaseModel):
    tables: list[TableReview]
    dialect: str


class PostgresConfig(BaseModel):
    host: str
    port: str
    database: str
    username: str
    password: str


class PostgresMetadataRequest(BaseModel):
    config: PostgresConfig
    selected_tables: list[str]


class ExecutionRequest(BaseModel):
    query: str
    dialect: str
    # config is optional — may be stored in session or provided per request
    config: Optional[PostgresConfig] = None


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    sql: str
    explanation: str
    dialect: str


class ExecutionResponse(BaseModel):
    columns: list[str]
    rows: list[list[Any]]
    hero_data: Optional[dict[str, Any]] = None
