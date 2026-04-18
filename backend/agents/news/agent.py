# LangGraph state graph — replaces the stateless RetrievalQA from AI_News_Research_Agent/app.py.
# retrieve → generate, with full multi-turn chat_history carried in state.

from typing import TypedDict

from langgraph.graph import END, StateGraph

from agents.news import embedder as news_embedder
from core.llm_client import call_claude
from core.logger import get_logger

logger = get_logger(__name__)


# ── State ─────────────────────────────────────────────────────────────────────

class NewsAgentState(TypedDict):
    session_id: str
    current_question: str
    # Full conversation history loaded from Redis before graph invocation.
    # Each entry: {"role": "user"|"assistant", "content": str}
    chat_history: list[dict]
    # Populated by the retrieve node; consumed by the generate node.
    retrieved_chunks: list[dict]
    # Populated by the generate node; read back by the router.
    answer: str
    sources: list[dict]  # [{"url", "title", "excerpt"}]


# ── Node 1: retrieve ──────────────────────────────────────────────────────────

def retrieve_node(state: NewsAgentState) -> dict:
    """
    Semantic search over the session FAISS store.
    Populates `retrieved_chunks` and builds a deduplicated `sources` list
    (one entry per unique URL, keeping the first/most-relevant excerpt).
    """
    chunks = news_embedder.retrieve_chunks(
        state["session_id"], state["current_question"], k=8
    )

    seen_urls: set[str] = set()
    sources: list[dict] = []
    for chunk in chunks:
        url = chunk["url"]
        if url not in seen_urls:
            sources.append({
                "url": url,
                "title": chunk["title"],
                "excerpt": chunk["content"][:300],
            })
            seen_urls.add(url)

    return {"retrieved_chunks": chunks, "sources": sources}


# ── Node 2: generate ──────────────────────────────────────────────────────────

def generate_node(state: NewsAgentState) -> dict:
    """
    Build a grounded prompt from retrieved chunks + conversation history,
    then call Claude to produce the answer.
    """
    chunks = state["retrieved_chunks"]
    question = state["current_question"]
    history = state["chat_history"]

    # Format the retrieved context (top 6 chunks)
    context_parts: list[str] = []
    for i, chunk in enumerate(chunks[:6], 1):
        context_parts.append(f"[Source {i} — {chunk['title']}]\n{chunk['content']}")
    context = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant context found."

    # Format the last 3 conversation turns (6 messages) for the prompt
    history_text = ""
    if history:
        lines: list[str] = []
        for msg in history[-6:]:
            prefix = "User" if msg["role"] == "user" else "Assistant"
            lines.append(f"{prefix}: {msg['content']}")
        history_text = "\n".join(lines)

    system = (
        "You are an expert news research assistant. "
        "Answer questions based strictly on the article excerpts provided below. "
        "If the answer cannot be found in the provided context, say so explicitly — "
        "do not hallucinate facts. Be concise and cite which source supports each claim. "
        "Respond in plain text only. Do not use markdown formatting, asterisks, bold, "
        "headers, bullet points, or any special symbols. Write in clear, readable "
        "paragraphs and numbered lists using plain text only."
    )

    history_block = f"Previous conversation:\n{history_text}\n\n" if history_text else ""
    prompt = (
        f"{history_block}"
        f"Article excerpts:\n{context}\n\n"
        f"Current question: {question}\n\n"
        f"Answer:"
    )

    try:
        answer = call_claude(prompt, system=system, temperature=0.1, max_tokens=1500)
    except Exception as exc:
        logger.error(f"Claude generation failed: {exc}")
        answer = "I encountered an error generating a response. Please try again."

    return {"answer": answer}


# ── Graph assembly ────────────────────────────────────────────────────────────

def _build_graph():
    graph: StateGraph = StateGraph(NewsAgentState)
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("generate", generate_node)
    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph.compile()


_news_agent = _build_graph()


# ── Public API ────────────────────────────────────────────────────────────────

def run_agent(
    session_id: str,
    question: str,
    chat_history: list[dict],
) -> dict:
    """
    Execute one retrieve → generate turn.

    `chat_history` is the full conversation so far (loaded from Redis by the router).
    Returns {"answer": str, "sources": list[dict], "confidence": str}.
    """
    initial_state: NewsAgentState = {
        "session_id": session_id,
        "current_question": question,
        "chat_history": chat_history,
        "retrieved_chunks": [],
        "answer": "",
        "sources": [],
    }

    result = _news_agent.invoke(initial_state)

    # Derive confidence from how many chunks were retrieved
    num_chunks = len(result.get("retrieved_chunks", []))
    confidence = "high" if num_chunks >= 5 else "medium" if num_chunks >= 2 else "low"

    return {
        "answer": result.get("answer", ""),
        "sources": result.get("sources", []),
        "confidence": confidence,
    }
