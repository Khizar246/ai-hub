# AI Hub

[![CI](https://github.com/Khizar246/ai-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/Khizar246/ai-hub/actions/workflows/ci.yml)

A unified platform consolidating three AI agents into a single FastAPI + React application, powered by Claude.

| Agent | What it does |
|---|---|
| **AI Audit Agent** | Upload documents (PDF, DOCX, PPTX, XLSX, CSV) plus a CSV of audit questions → compliance report with status, confidence, observations, and Excel export. Dual-layer PDF extraction (pdfplumber + Claude Vision) and HyDE semantic retrieval over ChromaDB. |
| **News Research Agent** | Paste article URLs → semantic Q&A with full multi-turn chat history and source citations. FAISS vector search + LangGraph conversational pipeline. |
| **TalkToData Engine** | Connect PostgreSQL, MySQL, or SQL Server — or upload Excel/CSV → plain English to validated SQL → execute → results table. Three-pass pipeline (generate → review → validate), SQLGlot AST validation, read-only execution guard. |

## Tech Stack

- **Backend** — Python 3.11, FastAPI, Anthropic SDK, LangGraph, VoyageAI embeddings, ChromaDB, FAISS, Redis, SQLGlot
- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS
- **Infrastructure** — Railway (backend + Redis), Vercel (frontend), GitHub Actions (CI)

## Quickstart

Prerequisites: Python 3.11+, Node.js 18+, Redis running locally.

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows; Linux/macOS: source venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example .env        # fill in ANTHROPIC_API_KEY and VOYAGE_API_KEY
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173 — proxies /api → backend:8000
```

## Configuration

All settings load from `backend/.env` via pydantic-settings. Required: `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `REDIS_URL`. Optional highlights:

| Variable | Default | Purpose |
|---|---|---|
| `CLAUDE_MODEL` | `claude-sonnet-4-5` | Main text-generation model |
| `CLAUDE_VISION_MODEL` | `claude-opus-4-5` | PDF image/table extraction |

See `.env.example` for the full list.

## Testing & Quality

```bash
# Unit + integration tests (no API keys or external services needed)
cd backend && venv\Scripts\python -m pytest tests -q

# NL-to-SQL accuracy eval (needs a real ANTHROPIC_API_KEY; costs a few cents)
cd backend && venv\Scripts\python -m evals.run_eval
```

CI runs the backend test suite and the frontend typecheck/build on every push and pull request.

## Observability

- `GET /health` — liveness probe
- `GET /stats` — today's LLM calls, token usage, estimated cost, and SQL execution failure rate (Redis-backed counters)

## Deployment

Push to `main` → GitHub Actions CI → Railway redeploys the backend, Vercel redeploys the frontend.

- **Railway** — root `backend/`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`; set `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `REDIS_URL`
- **Vercel** — root `frontend/`, build `npm run build`, output `dist/`; set `VITE_API_URL` to the Railway backend URL

## Repository Layout

```
backend/
  core/          # config, LLM client, auth, telemetry, session store, logging
  agents/        # audit / news / data — router + schemas + pipeline per agent
  middleware/    # rate limiter, request logger
  tests/         # pytest suite (runs in CI)
  evals/         # NL-to-SQL golden dataset + accuracy runner
frontend/
  src/agents/    # per-agent UI (audit / news / data)
  src/pages/     # Dashboard, AgentPage, Login
  src/lib/       # API client, agent registry, session hook
Data/            # sample datasets for trying the agents
```
