# AI Hub

A unified platform consolidating three AI agents into a single FastAPI + React application.

---

## Agents

| Agent | Description |
|---|---|
| **AI Audit Agent** | Upload documents and a CSV of audit questions. The agent analyzes documents against your questions using dual-layer extraction (pdfplumber + Claude Vision) and HyDE semantic retrieval over ChromaDB. |
| **News Research Agent** | Paste article URLs, scrape them via Crawl4AI, and ask questions over the indexed content. Powered by FAISS vector search and a LangGraph conversational agent with full chat history. |
| **TalkToData Engine** | Connect PostgreSQL or upload an Excel/SQLite file and ask questions in plain English. Claude generates validated SQL with sqlglot, executes it, and returns structured results. |

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- Redis (running locally on port 6379, or via Docker)
- An Anthropic API key (`ANTHROPIC_API_KEY`)
- A Voyage AI API key (`VOYAGE_API_KEY`) for embeddings

---

## Quick Start

```bash
# 1. Clone the repo and enter the project
git clone <repo-url>
cd ai-hub

# 2. Copy the example env file and fill in your keys
cp .env.example .env
# Open .env and set ANTHROPIC_API_KEY and VOYAGE_API_KEY at minimum

# 3. Install all dependencies (Python + Node)
make install

# 4. Start backend and frontend concurrently
make dev
```

Open http://localhost:5173 in your browser to access the dashboard.

---

## Development Commands

| Command | Description |
|---|---|
| `make install` | Install Python + Node dependencies |
| `make dev` | Run backend and frontend concurrently |
| `make dev-backend` | Run only the FastAPI backend with hot reload |
| `make dev-frontend` | Run only the Vite frontend dev server |
| `make docker-up` | Build and start all services via Docker Compose |
| `make docker-down` | Stop all Docker Compose services |
| `make lint` | Run ruff + mypy (Python) and eslint (TypeScript) |

---

## Docker

```bash
# Start everything (backend + frontend + Redis) in containers
make docker-up

# Stop
make docker-down
```

Requires Docker Desktop. The `.env` file is mounted into the backend container automatically.

---

## Folder Structure

```
ai-hub/
├── backend/
│   ├── main.py                  # FastAPI app — mounts all agent routers
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── core/                    # Shared infrastructure (LLM client, sessions, config)
│   └── agents/
│       ├── audit/               # AI Audit Agent
│       ├── news/                # News Research Agent
│       └── data/                # TalkToData Engine
└── frontend/
    ├── package.json
    ├── vite.config.ts           # Proxies /api → localhost:8000
    ├── Dockerfile
    └── src/
        ├── App.tsx              # React Router entry
        ├── lib/                 # api.ts, agentRegistry.ts, hooks
        ├── components/          # Shared layout + UI components
        ├── pages/               # Dashboard, AgentPage
        └── agents/              # audit/, news/, data/ UIs
```

---

## Architecture Notes

- All LLM calls go through `backend/core/llm_client.py` — never call Anthropic directly in agent code.
- Session state is persisted in Redis via `backend/core/session_manager.py`.
- The frontend reads `src/lib/agentRegistry.ts` as the single source of truth for all agent metadata.
- Adding a fourth agent = one entry in `agentRegistry.ts` + one folder in `backend/agents/` + one folder in `frontend/src/agents/`.

See `CLAUDE.md` for the full specification, build order, and migration guide.