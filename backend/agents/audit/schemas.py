# Pydantic request/response schemas for the Audit Agent.

from __future__ import annotations

from pydantic import BaseModel, Field


class AuditResultItem(BaseModel):
    rule: str
    status: str                         # Present / Partially Present / Inadequate / Not Present / Error
    observation: str
    recommendation: str
    risk: str
    page_numbers: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    criticality: str
    requires_action: bool
    validation_note: str | None = None


class AuditSummary(BaseModel):
    total_rules: int
    status_counts: dict[str, int]
    action_items: int
    high_priority_issues: int
    average_confidence: float
    compliance_rate: float


class AuditResponse(BaseModel):
    session_id: str
    category: str
    results: list[AuditResultItem]
    summary: AuditSummary


class ExportRequest(BaseModel):
    session_id: str
    category: str


class QuestionValidationResponse(BaseModel):
    valid: bool
    question_count: int
    preview: list[str]      # first 3 question strings
    error: str | None = None
