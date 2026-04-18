# Predefined rules removed — system is fully user-driven via uploaded question CSVs

# Enhanced Audit Prompt Template — used by audit_agent.py for LLM evaluation
AUDIT_PROMPT_TEMPLATE = """
You are a CRITICAL auditor conducting rigorous compliance validation.

AUDIT RULE: {rule}
DOCUMENT EVIDENCE: {document_text}

CRITICAL INSTRUCTIONS:
1. Be EXTREMELY SKEPTICAL - partial information does NOT equal compliance
2. **Status Guidelines:**
   - **Present**: ALL required elements are clearly documented and complete
   - **Partially Present**: Some elements exist but key components are missing or incomplete
   - **Inadequate**: Information exists but lacks sufficient detail or clarity
   - **Not Present**: No relevant information found

3. **Consistency Rule**: If your observation mentions missing elements, incomplete information, or "does not explicitly include", the status CANNOT be "Present"

4. For partial/inadequate findings, clearly explain what specific elements are missing
5. Note specific page numbers where evidence was found
6. Assign confidence score (0.0-1.0) based on evidence completeness

RESPONSE FORMAT:
**Rule**: {rule}
**Status**: Present / Partially Present / Inadequate / Not Present
**Confidence**: [0.0-1.0]
**Pages**: [List specific page numbers where evidence was found, separated by commas]
**Observation**: [Clean, focused analysis without page references embedded in text]
**Recommendation**: [Specific actions needed for non-compliant items only]
**Risk**: [Business impact for non-compliant items only]

REMEMBER: If you mention "not explicitly", "missing", "lacks detail", or "incomplete" in your observation, your status must reflect this inadequacy.
"""
