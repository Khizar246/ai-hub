# LangGraph audit pipeline: retrieve → evaluate → verify for each audit rule.

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, TypedDict

from langgraph.graph import END, StateGraph

from agents.audit.agents.hyde_retriever import generate_hyde_query
from agents.audit.agents.rules import AUDIT_PROMPT_TEMPLATE
from agents.audit.agents.verifier import AuditResultVerifier
from agents.audit.processors.embedder import retrieve_chunks
from core.llm_client import call_claude
from core.logger import get_logger

logger = get_logger("audit.agent")

verifier = AuditResultVerifier()


# ---------------------------------------------------------------------------
# LangGraph State
# ---------------------------------------------------------------------------

class AuditState(TypedDict):
    session_id: str
    rule: str
    criticality: str
    retrieved_chunks: List[str]
    raw_llm_output: str
    parsed_result: Dict[str, Any]


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

def retrieve_node(state: AuditState) -> AuditState:
    """Generate a HyDE query and retrieve relevant chunks from ChromaDB."""
    rule = state["rule"]
    session_id = state["session_id"]

    hyde_query = generate_hyde_query(rule)
    chunks = retrieve_chunks(session_id, hyde_query)

    logger.info(f"retrieved_chunks session_id={session_id} count={len(chunks)} rule={rule[:50]}")
    return {**state, "retrieved_chunks": chunks}


def evaluate_node(state: AuditState) -> AuditState:
    """Send the rule + retrieved evidence to Claude for evaluation."""
    rule = state["rule"]
    chunks = state["retrieved_chunks"]

    if not chunks:
        document_text = "No relevant content was found in the uploaded documents."
    else:
        document_text = "\n\n---\n\n".join(chunks)

    prompt = AUDIT_PROMPT_TEMPLATE.format(rule=rule, document_text=document_text)

    raw_output = call_claude(
        prompt=prompt,
        temperature=0.1,
        max_tokens=1500,
    )
    logger.info(f"rule_evaluated rule={rule[:50]} output_chars={len(raw_output)}")
    return {**state, "raw_llm_output": raw_output}


def verify_node(state: AuditState) -> AuditState:
    """Parse and validate the LLM output into a structured result."""
    parsed = verifier.parse_audit_result(state["raw_llm_output"], state["rule"])
    parsed["criticality"] = state["criticality"]
    parsed = verifier.validate_result_completeness(parsed)
    return {**state, "parsed_result": parsed}


# ---------------------------------------------------------------------------
# Build graph
# ---------------------------------------------------------------------------

def _build_graph() -> Any:
    g = StateGraph(AuditState)
    g.add_node("retrieve", retrieve_node)
    g.add_node("evaluate", evaluate_node)
    g.add_node("verify", verify_node)
    g.set_entry_point("retrieve")
    g.add_edge("retrieve", "evaluate")
    g.add_edge("evaluate", "verify")
    g.add_edge("verify", END)
    return g.compile()


_graph = _build_graph()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def conduct_audit(
    session_id: str,
    rules: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Run the audit graph for each rule in the list.
    Returns a list of parsed result dicts.

    Each rule dict must have keys: "rule" (str), "criticality" (str).
    Rules are evaluated concurrently in batches of 5 to avoid rate limits.
    """
    BATCH_SIZE = 5

    async def _run_rule(rule_def: Dict[str, Any]) -> Dict[str, Any]:
        initial_state: AuditState = {
            "session_id": session_id,
            "rule": rule_def["rule"],
            "criticality": rule_def.get("criticality", "Medium"),
            "retrieved_chunks": [],
            "raw_llm_output": "",
            "parsed_result": {},
        }
        try:
            final_state = await asyncio.to_thread(_graph.invoke, initial_state)
            return final_state["parsed_result"]
        except Exception as exc:
            logger.error(f"rule_audit_failed rule={rule_def['rule'][:50]} error={exc}")
            return {
                "rule": rule_def["rule"],
                "status": "Error",
                "observation": f"Audit pipeline error: {exc}",
                "recommendation": "",
                "risk": "",
                "page_numbers": "",
                "confidence_score": 0.0,
                "criticality": rule_def.get("criticality", "Medium"),
                "requires_action": True,
            }

    results: List[Dict[str, Any]] = []
    for i in range(0, len(rules), BATCH_SIZE):
        batch = rules[i : i + BATCH_SIZE]
        batch_results = await asyncio.gather(*[_run_rule(r) for r in batch])
        results.extend(batch_results)
        logger.info(f"batch_complete session_id={session_id} batch={i // BATCH_SIZE + 1} done={len(results)} total={len(rules)}")

    return results
