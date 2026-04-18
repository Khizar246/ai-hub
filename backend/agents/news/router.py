# APIRouter for News Research Agent — POST /ingest, /ask, GET /history, DELETE /clear

import asyncio
from typing import Annotated, Optional

from fastapi import APIRouter, Header, HTTPException

from agents.news import embedder as news_embedder
from agents.news import scraper as news_scraper
from agents.news.agent import run_agent
from agents.news.schemas import (
    AnswerResponse,
    ArticleSummary,
    ChatMessage,
    HistoryResponse,
    IngestRequest,
    IngestResponse,
    QuestionRequest,
    Source,
)
from core.logger import get_logger
from core.session_manager import session_manager

logger = get_logger(__name__)

router = APIRouter()

# Redis key suffixes for session-scoped state
_URLS_KEY = "news:processed_urls"
_HISTORY_KEY = "news:chat_history"


def _require_session(x_session_id: Optional[str]) -> str:
    if not x_session_id:
        raise HTTPException(status_code=400, detail="X-Session-ID header is required.")
    return x_session_id


# ---------------------------------------------------------------------------
# POST /ingest
# ---------------------------------------------------------------------------

@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    request: IngestRequest,
    x_session_id: Annotated[Optional[str], Header()] = None,
) -> IngestResponse:
    """
    Scrape each URL with Crawl4AI, embed only new URLs (URL-based caching),
    and return per-article processing summaries.
    """
    session_id = _require_session(x_session_id)

    # 1. Scrape all URLs concurrently (crawl4ai is async-native)
    scraped = await news_scraper.scrape_urls(request.urls)

    # 2. Determine which URLs are already embedded for this session
    stored_urls: list[str] = (await session_manager.get(session_id, _URLS_KEY)) or []
    already_processed: set[str] = set(stored_urls)

    # 3. Embed new articles — blocking I/O runs in a thread so the event loop stays free
    articles_to_embed = [a for a in scraped if not a.get("error")]
    _, newly_embedded = await asyncio.to_thread(
        news_embedder.embed_articles,
        session_id,
        articles_to_embed,
        already_processed,
    )

    # 4. Persist the updated URL set to Redis
    updated_urls = list(already_processed | set(newly_embedded))
    await session_manager.set(session_id, _URLS_KEY, updated_urls)

    # 5. Build response with per-article status
    summaries: list[ArticleSummary] = []
    processed_count = 0
    for article in scraped:
        url = article["url"]
        if article.get("error"):
            summaries.append(ArticleSummary(
                url=url,
                title=article["title"],
                word_count=0,
                status="error",
                error=article["error"],
            ))
        elif url in already_processed and url not in newly_embedded:
            summaries.append(ArticleSummary(
                url=url,
                title=article["title"],
                word_count=article["word_count"],
                status="skipped",
            ))
        else:
            summaries.append(ArticleSummary(
                url=url,
                title=article["title"],
                word_count=article["word_count"],
                status="ok",
            ))
            processed_count += 1

    return IngestResponse(articles_processed=processed_count, articles=summaries)


# ---------------------------------------------------------------------------
# POST /ask
# ---------------------------------------------------------------------------

@router.post("/ask", response_model=AnswerResponse)
async def ask(
    request: QuestionRequest,
    x_session_id: Annotated[Optional[str], Header()] = None,
) -> AnswerResponse:
    """
    Run the LangGraph retrieve → generate pipeline for one conversational turn.
    Chat history is loaded from Redis before invocation and persisted after.
    """
    session_id = _require_session(x_session_id)

    # Guard: require at least one ingested article
    stored_urls = await session_manager.get(session_id, _URLS_KEY)
    if not stored_urls:
        raise HTTPException(
            status_code=400,
            detail="No articles ingested yet. Please ingest URLs first.",
        )

    # Load full chat history from Redis
    raw_history: list[dict] = (await session_manager.get(session_id, _HISTORY_KEY)) or []

    # Run retrieve → generate in a thread (FAISS + Anthropic SDK are blocking)
    result = await asyncio.to_thread(
        run_agent, session_id, request.question, raw_history
    )

    # Persist updated history to Redis (2-hour TTL)
    updated_history = raw_history + [
        {"role": "user",      "content": request.question,   "sources": []},
        {"role": "assistant", "content": result["answer"],    "sources": result["sources"]},
    ]
    await session_manager.set(session_id, _HISTORY_KEY, updated_history, ttl=7200)

    return AnswerResponse(
        answer=result["answer"],
        sources=[Source(**s) for s in result["sources"]],
        confidence=result["confidence"],
    )


# ---------------------------------------------------------------------------
# GET /history/{session_id}
# ---------------------------------------------------------------------------

@router.get("/history/{session_id}", response_model=HistoryResponse)
async def get_history(session_id: str) -> HistoryResponse:
    """Return the full chat history stored in Redis for a session."""
    raw_history: list[dict] = (await session_manager.get(session_id, _HISTORY_KEY)) or []
    messages = [
        ChatMessage(
            role=m["role"],
            content=m["content"],
            sources=[Source(**s) for s in m.get("sources", [])],
        )
        for m in raw_history
    ]
    return HistoryResponse(messages=messages)


# ---------------------------------------------------------------------------
# DELETE /clear/{session_id}
# ---------------------------------------------------------------------------

@router.delete("/clear/{session_id}")
async def clear_session(session_id: str) -> dict:
    """Wipe the session FAISS store from disk and remove chat history from Redis."""
    await asyncio.to_thread(news_embedder.clear_vectorstore, session_id)
    await session_manager.delete(session_id, _URLS_KEY)
    await session_manager.delete(session_id, _HISTORY_KEY)
    logger.info(f"Cleared news session: {session_id}")
    return {"status": "cleared", "session_id": session_id}
