# HyDE retrieval: generate a hypothetical compliant passage to use as the semantic search query.

from __future__ import annotations

from core.llm_client import call_claude
from core.logger import get_logger

logger = get_logger("audit.hyde_retriever")

HYDE_SYSTEM = (
    "You are a compliance documentation expert. "
    "Write realistic, detailed passages from compliant project documents."
)

HYDE_PROMPT = """Write a concise paragraph (3-5 sentences) from a well-written, fully compliant
project document that clearly satisfies the following audit requirement:

AUDIT REQUIREMENT: {rule}

Write ONLY the paragraph — no preamble, no explanation, no labels.
The paragraph should read like genuine document text, not a checklist."""


def generate_hyde_query(rule: str) -> str:
    """
    Given an audit rule string, ask Claude to produce a hypothetical paragraph that
    a *fully compliant* document would contain. This generated text is then used as the
    vector search query instead of the raw rule keywords, dramatically improving recall
    for semantically rich compliance checks.

    Falls back to the original rule string if the LLM call fails.
    """
    try:
        prompt = HYDE_PROMPT.format(rule=rule)
        hypothetical = call_claude(
            prompt=prompt,
            system=HYDE_SYSTEM,
            temperature=0.3,
            max_tokens=300,
        )
        logger.info(f"hyde_query_generated rule_snippet={rule[:60]} chars={len(hypothetical)}")
        return hypothetical.strip()
    except Exception as exc:
        logger.warning(f"hyde_generation_failed error={exc} fallback=original rule")
        return rule
