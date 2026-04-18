# Audit result parser and verifier — ported from AI_Audit_Agent, helpers inlined.

from __future__ import annotations

import re
from typing import Any, Dict, List

from core.logger import get_logger

logger = get_logger("audit.verifier")


# ---------------------------------------------------------------------------
# Inlined helper functions (originally in AI_Audit_Agent/src/utils/helpers.py)
# ---------------------------------------------------------------------------

def _clean_observation_text(observation: str) -> str:
    """Remove page references from observation text to keep it clean."""
    if not observation:
        return ""
    patterns = [
        r"\(page\s+\d+\)",
        r"\[page\s+\d+\]",
        r"on\s+page\s+\d+",
        r"page\s+\d+\s+shows",
        r"as\s+seen\s+on\s+page\s+\d+",
        r"\[PAGE\s+\d+\]",
    ]
    cleaned = observation
    for pattern in patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", cleaned).strip()


def _clean_page_numbers(pages_text: str) -> str:
    """Clean and format page numbers."""
    if not pages_text or pages_text.lower() in ["not specified", "unknown", "n/a"]:
        return "Not Specified"
    numbers = re.findall(r"\d+", pages_text)
    if numbers:
        unique_numbers = sorted(set(int(n) for n in numbers))
        return ", ".join(map(str, unique_numbers))
    return "Not Specified"


def _extract_page_numbers_from_content(content: str) -> str:
    """Extract page numbers from content as fallback."""
    if not content:
        return "Not Specified"
    page_matches = re.findall(r"\[PAGE\s+(\d+)\]", content, re.IGNORECASE)
    if page_matches:
        unique_pages = sorted(set(int(p) for p in page_matches))
        return ", ".join(map(str, unique_pages))
    return "Not Specified"


def _normalize_status(status_text: str) -> str:
    """Normalize status text to standard categories with strict validation."""
    status_lower = status_text.lower()
    if any(
        phrase in status_lower
        for phrase in ["present", "fully compliant", "satisfied", "complete", "adequate"]
    ) and not any(
        phrase in status_lower
        for phrase in ["partially", "incomplete", "missing", "not explicit", "lacks", "insufficient"]
    ):
        return "Present"
    elif any(
        phrase in status_lower
        for phrase in ["partially", "incomplete", "partial", "some evidence", "not explicit"]
    ):
        return "Partially Present"
    elif any(
        phrase in status_lower
        for phrase in ["inadequate", "insufficient", "poor", "lacks detail", "unclear"]
    ):
        return "Inadequate"
    elif any(
        phrase in status_lower
        for phrase in ["not present", "missing", "absent", "not found", "no evidence"]
    ):
        return "Not Present"
    else:
        return "Unclear"


def _validate_status_consistency(result: Dict[str, Any]) -> Dict[str, Any]:
    """Validate that status is consistent with observation content."""
    observation = result.get("observation", "").lower()
    current_status = result.get("status", "")
    inconsistency_flags = [
        "not explicitly", "missing", "lacks", "incomplete", "insufficient",
        "does not include", "not detailed", "not clearly defined", "absent",
    ]
    if current_status == "Present" and any(flag in observation for flag in inconsistency_flags):
        if any(phrase in observation for phrase in ["some", "partial", "mentions"]):
            result["status"] = "Partially Present"
        else:
            result["status"] = "Inadequate"
        result["validation_note"] = "Status adjusted for consistency with findings"
    return result


# ---------------------------------------------------------------------------
# Main verifier class
# ---------------------------------------------------------------------------

class AuditResultVerifier:
    """Handles verification and parsing of audit results."""

    def parse_audit_result(self, audit_result: str, rule: str) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "rule": rule,
            "status": "Not Analyzed",
            "observation": "",
            "recommendation": "",
            "risk": "",
            "page_numbers": "",
            "confidence_score": 0.0,
            "criticality": "Medium",
            "requires_action": False,
        }
        try:
            result = self._extract_audit_fields(audit_result, result)
            result = self._validate_and_clean_result(result, audit_result)
            result = self._determine_action_requirements(result)
            logger.debug(f"parsed_audit_result rule={rule[:50]}")
        except Exception as exc:
            logger.error(f"parse_error rule={rule[:50]} error={exc}")
            result["status"] = "Error"
            result["observation"] = f"Parsing error: {exc}"
            result["requires_action"] = True
        return result

    def _extract_audit_fields(
        self, audit_result: str, result: Dict[str, Any]
    ) -> Dict[str, Any]:
        lines = audit_result.split("\n")
        current_key: str | None = None

        for line in lines:
            line = line.strip()
            if re.search(r"\*\*Status\*\*\s*:", line, re.IGNORECASE):
                status_text = re.sub(r"\*\*Status\*\*\s*:", "", line, flags=re.IGNORECASE).strip()
                result["status"] = _normalize_status(status_text)
            elif re.search(r"\*\*Confidence\*\*\s*:", line, re.IGNORECASE):
                confidence_text = re.sub(r"\*\*Confidence\*\*\s*:", "", line, flags=re.IGNORECASE).strip()
                result["confidence_score"] = self._parse_confidence(confidence_text)
            elif re.search(r"\*\*Pages\*\*\s*:", line, re.IGNORECASE):
                pages_text = re.sub(r"\*\*Pages\*\*\s*:", "", line, flags=re.IGNORECASE).strip()
                result["page_numbers"] = _clean_page_numbers(pages_text)
            elif re.search(r"\*\*Observation\*\*\s*:", line, re.IGNORECASE):
                current_key = "observation"
                value = re.sub(r"\*\*Observation\*\*\s*:", "", line, flags=re.IGNORECASE).strip()
                if value:
                    result[current_key] = value
            elif re.search(r"\*\*Recommendation\*\*\s*:", line, re.IGNORECASE):
                current_key = "recommendation"
                value = re.sub(r"\*\*Recommendation\*\*\s*:", "", line, flags=re.IGNORECASE).strip()
                if value:
                    result[current_key] = value
            elif re.search(r"\*\*Risk\*\*\s*:", line, re.IGNORECASE):
                current_key = "risk"
                value = re.sub(r"\*\*Risk\*\*\s*:", "", line, flags=re.IGNORECASE).strip()
                if value:
                    result[current_key] = value
            elif current_key and line and not line.startswith("**"):
                result[current_key] += " " + line

        return result

    def _parse_confidence(self, confidence_text: str) -> float:
        try:
            numbers = re.findall(r"(\d+(?:\.\d+)?)", confidence_text)
            if numbers:
                confidence = float(numbers[0])
                if confidence > 1.0:
                    confidence = confidence / 100.0
                return max(0.0, min(1.0, confidence))
            return 0.0
        except (ValueError, IndexError):
            return 0.0

    def _validate_and_clean_result(
        self, result: Dict[str, Any], audit_result: str
    ) -> Dict[str, Any]:
        result["observation"] = _clean_observation_text(result["observation"])
        if not result["page_numbers"] or result["page_numbers"] == "Not Specified":
            result["page_numbers"] = _extract_page_numbers_from_content(audit_result)
        result = _validate_status_consistency(result)
        return result

    def _determine_action_requirements(self, result: Dict[str, Any]) -> Dict[str, Any]:
        result["requires_action"] = result["status"] in [
            "Not Present", "Partially Present", "Inadequate", "Error"
        ]
        return result

    def validate_result_completeness(self, result: Dict[str, Any]) -> Dict[str, Any]:
        required_fields = [
            "rule", "status", "observation", "recommendation",
            "risk", "page_numbers", "confidence_score", "criticality",
        ]
        for field in required_fields:
            if field not in result:
                if field == "confidence_score":
                    result[field] = 0.0
                elif field == "criticality":
                    result[field] = "Medium"
                else:
                    result[field] = ""
        return result

    def get_result_summary(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not results:
            return {"error": "No results to summarize"}
        total_rules = len(results)
        status_counts: Dict[str, int] = {}
        for status in ["Present", "Partially Present", "Inadequate", "Not Present", "Unclear", "Error"]:
            status_counts[status] = sum(1 for r in results if r.get("status") == status)
        action_items = sum(1 for r in results if r.get("requires_action", False))
        high_priority_issues = sum(
            1 for r in results
            if r.get("criticality") == "High" and r.get("requires_action", False)
        )
        avg_confidence = sum(r.get("confidence_score", 0.0) for r in results) / total_rules
        compliance_rate = (status_counts.get("Present", 0) / total_rules) * 100
        return {
            "total_rules": total_rules,
            "status_counts": status_counts,
            "action_items": action_items,
            "high_priority_issues": high_priority_issues,
            "average_confidence": round(avg_confidence, 3),
            "compliance_rate": round(compliance_rate, 1),
        }
