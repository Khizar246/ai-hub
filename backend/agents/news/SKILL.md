# News Research Agent — Skill File

## What It Does
Ingests news article URLs, scrapes and embeds content into a session-scoped FAISS store, then answers questions with multi-turn conversation history and source citations.

## Key Files
| File | Purpose |
|---|---|
| `router.py` | POST /ingest, POST /ask, GET /history/{session_id}, DELETE /clear/{session_id} |
| `schemas.py` | IngestRequest, QuestionRequest, ArticleSummary, ChatMessage |
| `scraper.py` | httpx + BeautifulSoup async scraper |
| `embedder.py` | FAISS in-memory store with URL-based cache |
| `agent.py` | LangGraph: retrieve → generate with chat history |

## Pipeline Flow
```
POST /ingest URLs
    → scraper.py (httpx + BeautifulSoup)
    → Skip if URL already in session FAISS cache
    → Chunk text → VoyageAI embed → FAISS store

POST /ask question
    → FAISS semantic search (top 8 chunks)
    → Deduplicate sources by URL
    → Build prompt: top 6 chunks + last 3 chat turns (from Redis)
    → Claude generates answer with source citations
    → Save to Redis chat history
    → Return {answer, sources, confidence}
```

## Confidence Scoring
```python
chunks_found >= 5 → "high"
chunks_found >= 2 → "medium"
else             → "low"
```

## Known Scraping Limitations
Sites that block server IPs (Railway's IPs are flagged by major news sites):
- Reuters — blocks server requests
- ESPN/ESPNCricinfo — returns Access Denied
- Paywalled sites — cannot be accessed

Sites that work well: Al Jazeera, BBC, Dawn, Geo, Guardian, Wikipedia, most blogs.

DO NOT attempt to fix Reuters/ESPN blocking with headers or proxies — it's an IP-level block.
The correct response to scraping failure is already implemented: user-friendly error message.

## Pre-loaded Sample URL
`UrlInputPanel.tsx` pre-populates the first URL field with a Wikipedia article.
To change this, edit the `useState` default value in `frontend/src/agents/news/UrlInputPanel.tsx`.

## Extending
- To add Wikipedia API support: add a special case in `scraper.py` checking for `wikipedia.org` URLs and calling `https://en.wikipedia.org/api/rest_v1/page/summary/{title}` instead of scraping
- To increase context window: change `top 6 chunks` in `agent.py` (watch token costs)
- To change chat history depth: change `last 3 turns` in `agent.py`
