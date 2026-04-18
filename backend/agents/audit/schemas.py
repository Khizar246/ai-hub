# Pydantic request/response schemas for the Audit Agent.

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    session_id: str
    filename: str
    pages: int
    vision_pages: int   # pages that required vision extraction
    chunks_stored: int


class ProcessRequest(BaseModel):
    session_id: str


class ProcessResponse(BaseModel):
    session_id: str
    pages: int
    vision_pages: int
    chunks_stored: int
    status: str = "ready"


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
    validation_note: Optional[str] = None


class AuditSummary(BaseModel):
    total_rules: int
    status_counts: Dict[str, int]
    action_items: int
    high_priority_issues: int
    average_confidence: float
    compliance_rate: float


class AuditResponse(BaseModel):
    session_id: str
    category: str
    results: List[AuditResultItem]
    summary: AuditSummary


class ExportRequest(BaseModel):
    session_id: str
    category: str


class DynamicAuditRequest(BaseModel):
    session_id: str
    use_custom_questions: bool = True


class QuestionValidationResponse(BaseModel):
    valid: bool
    question_count: int
    preview: List[str]      # first 3 question strings
    error: Optional[str] = None
