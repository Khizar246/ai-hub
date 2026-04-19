# AI Hub — Platform Skill File

> Read this entire file before making any changes to AI Hub. This is the master reference for the platform. For agent-specific details, read the SKILL.md in the relevant agent folder.

---

## What AI Hub Is

AI Hub is a unified web platform that consolidates three independent AI tools into a single production-deployed application. Each tool was originally a standalone Streamlit prototype. AI Hub rebuilds them with a FastAPI backend, React frontend, Claude API integration, and proper cloud deployment.

| Agent | Core Problem It Solves |
|---|---|
| AI Audit Agent | Compliance review of documents is manual and slow. The agent automates this against any custom question set. |
| News Research Agent | Reading and understanding long articles takes time. The agent lets users ask specific questions about any article. |
| TalkToData Engine | Non-technical users cannot write SQL. The agent translates plain English to validated, executable SQL. |

**Live URLs:**
- Frontend: `https://ai-hub-orpin-six.vercel.app`
- Backend: `https://ai-hub-production-dc3a.up.railway.app`
- GitHub: `https://github.com/Khizar246/ai-hub`

---

## Tech Stack — Full Detail

### Backend
- **Python 3.11+** — runtime
- **FastAPI + Uvicorn** — web framework and ASGI server
- **Anthropic SDK** — all LLM calls (`claude-sonnet-4-5` main, `claude-opus-4-5` vision only)
- **LangGraph** — agent orchestration for audit and news pipelines
- **VoyageAI voyage-3** — all text embeddings
- **ChromaDB** — vector store for audit agent (session-scoped)
- **FAISS** — vector store for news agent (in-memory, session-scoped)
- **Redis** — session state, chat history, audit results cache
- **SQLGlot** — SQL AST validation and dialect transpilation
- **pdfplumber + PyMuPDF** — dual-layer PDF extraction
- **httpx + BeautifulSoup** — news article scraping
- **psycopg2-binary** — PostgreSQL adapter
- **sqlite3** — SQLite adapter (built-in)
- **openpyxl** — Excel read (TalkToData) and write (Audit export)
- **pydantic-settings v2** — config management

### Frontend
- **React 18 + TypeScript** — UI framework
- **Vite** — build tool and dev server
- **Tailwind CSS** — styling (utility-first, dark-only)
- **react-router-dom v6** — client-side routing
- **zustand** — global state (dark mode, UI preferences)
- **axios** — HTTP client with session ID interceptor
- **lucide-react** — icon library
- **react-syntax-highlighter** — SQL code display
- **react-dropzone** — file upload UI

### Infrastructure
- **Railway** — backend hosting + managed Redis
- **Vercel** — frontend hosting (CDN, SPA routing)
- **GitHub** — source control + auto-deploy trigger

---

## Absolute Rules — Never Break These

These rules exist because breaking them has caused real bugs or architectural problems before.

**1. ALL LLM calls go through `core/llm_client.py`**
Use `call_claude()` or `call_claude_vision()`. Never instantiate `anthropic.Anthropic()` directly in any agent file. This ensures consistent logging, error handling, and model configuration.

**2. ALL config comes from `core/config.py` → `settings.*`**
Never hardcode API keys, model names, or paths. Every configurable value must be in `.env` and read through `settings`. This is what makes Railway deployment work without code changes.

**3. ALL session state goes through `core/session_manager.py`**
Never store session data in global variables or module-level dicts. The app runs with multiple worker processes in production — only Redis is shared across workers.

**4. NEVER modify the original prototype folders**
`AI_Audit_Agent/`, `AI_News_Research_Agent/`, `Talk_To_Data_Engine/` are read-only reference material. All active code lives in `ai-hub/`.

**5. App is dark-only — no light mode**
Never add `dark:` prefixed Tailwind classes. Never add a light/dark toggle. The Precision Noir theme is permanent. Any PR that adds light mode classes will break the visual consistency.

**6. No gradients, glassmorphism, or glow effects**
The design system is flat, sharp, and minimal. No `bg-gradient-*`, no `backdrop-blur`, no `shadow-{color}` glow effects. Depth is achieved through border contrast and background shade differences only.

**7. Reviewer output is never returned to users**
The SQL reviewer in TalkToData is an internal quality gate. Its output (`review_notes`, corrections, issues) must never appear in API responses or UI. Users only see the final SQL.

**8. `vercel.json` belongs in `frontend/` not the repo root**
Vercel's root directory is set to `frontend/`. A `vercel.json` in the repo root is outside Vercel's scope and will be silently ignored, causing SPA routing to break (404 on page refresh).

---

## Project Structure — Where Everything Lives

```
AI_Agents/
├── CLAUDE.md                        ← Platform blueprint (read first)
├── ai-hub/                          ← ALL active code lives here
│   ├── SKILL.md                     ← This file
│   ├── .env.example                 ← Copy to backend/.env and fill in keys
│   ├── .gitignore                   ← .env, venv, node_modules, storage/* excluded
│   ├── Data/                        ← Sample files for demo downloads
│   │   ├── Audit_Agent/             ← Sample audit doc + questions CSV
│   │   └── TalkToData/              ← Sample finance Excel file
│   │
│   ├── backend/
│   │   ├── main.py                  ← App entrypoint: lifespan, CORS, routers, health
│   │   ├── requirements.txt         ← All Python dependencies
│   │   ├── Dockerfile               ← Railway uses this
│   │   ├── core/                    ← Shared infrastructure
│   │   │   ├── config.py            ← pydantic-settings: all env vars
│   │   │   ├── llm_client.py        ← call_claude() + call_claude_vision()
│   │   │   ├── embeddings.py        ← VoyageAI setup
│   │   │   ├── session_manager.py   ← Redis async session store
│   │   │   ├── registry.py          ← Backend agent registry
│   │   │   ├── logger.py            ← Structured JSON logging
│   │   │   └── exceptions.py        ← Custom exceptions + error handlers
│   │   ├── agents/
│   │   │   ├── audit/               ← See audit/SKILL.md for full detail
│   │   │   ├── news/                ← See news/SKILL.md for full detail
│   │   │   └── data/                ← See data/SKILL.md for full detail
│   │   ├── middleware/
│   │   │   ├── rate_limiter.py      ← Per-session LLM call rate limiting
│   │   │   └── request_logger.py    ← Request/response logging with latency
│   │   └── storage/                 ← Runtime data — gitignored
│   │       ├── uploads/             ← User-uploaded files (session-scoped)
│   │       ├── vector_stores/       ← ChromaDB collections (audit)
│   │       └── exports/             ← Generated Excel reports (audit)
│   │
│   └── frontend/
│       ├── vercel.json              ← SPA routing: all paths → index.html
│       ├── vite.config.ts           ← /api proxy for dev, VITE_API_URL for prod
│       ├── tailwind.config.ts       ← Custom noir colors + font families
│       ├── src/
│       │   ├── index.css            ← CSS variables (Precision Noir tokens)
│       │   ├── App.tsx              ← Routes: / and /agent/:id
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── Shell.tsx    ← Sidebar + Topbar + content area + ContactFloat
│       │   │   │   ├── Topbar.tsx   ← Breadcrumb navigation
│       │   │   │   └── Sidebar.tsx  ← Agent nav + About Me button
│       │   │   └── ui/              ← Shared components
│       │   │       ├── Button.tsx
│       │   │       ├── Badge.tsx
│       │   │       ├── StatusPill.tsx    ← Audit status colors (semantic — do not change)
│       │   │       ├── CodeBlock.tsx     ← SQL syntax highlighting
│       │   │       ├── FileDropzone.tsx  ← Drag-and-drop upload
│       │   │       ├── ChatBubble.tsx    ← News chat messages
│       │   │       ├── StreamingText.tsx ← SSE token renderer
│       │   │       ├── ProgressBar.tsx
│       │   │       └── ContactFloat.tsx  ← About Me modal (triggered from sidebar)
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx    ← 3-column agent grid from agentRegistry
│       │   │   └── AgentPage.tsx    ← Description + how it works + agent UI
│       │   ├── agents/
│       │   │   ├── audit/           ← AuditAgent, DynamicUploadStep, ResultsPanel
│       │   │   ├── news/            ← NewsAgent, UrlInputPanel, ChatInterface, SourceCard
│       │   │   └── data/            ← DataAgent, ConnectionPanel, SchemaEditor, QueryWorkspace
│       │   └── lib/
│       │       ├── agentRegistry.ts ← SOURCE OF TRUTH for all agent metadata
│       │       ├── api.ts           ← Axios: baseURL + X-Session-ID interceptor
│       │       ├── store.ts         ← Zustand: UI state (dark mode always true)
│       │       ├── types.ts         ← All shared TypeScript interfaces
│       │       ├── useSession.ts    ← Generates + persists session_id in localStorage
│       │       └── useSSE.ts        ← EventSource hook for streaming
│       └── public/
│           └── samples/             ← Demo files served statically
│               ├── sample_audit_document.docx
│               ├── sample_audit_questions.csv
│               └── sample_finance_data.xlsx
│
├── AI_Audit_Agent/                  ← READ ONLY — original Streamlit prototype
├── AI_News_Research_Agent/          ← READ ONLY — original Streamlit prototype
└── Talk_To_Data_Engine/             ← READ ONLY — original prototype
```

---

## Frontend Design System — Precision Noir

Every UI decision follows this system. Do not deviate.

### Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `--noir-base` | `#0a0a0a` | Page background, deepest surfaces |
| `--noir-surface` | `#111111` | Cards, panels, inputs |
| `--noir-elevated` | `#1a1a1a` | Hover states, dropdowns |
| `--noir-border` | `#1e1e1e` | Default borders |
| `--noir-border-strong` | `#262626` | Emphasized borders |
| `--noir-highlight` | `#404040` | Active/focus borders |
| `--amber` | `#f59e0b` | Primary accent — CTA buttons, Q. prefix, active nav, amber dots |
| `--amber-hover` | `#fbbf24` | Amber hover state |
| `--text-primary` | `#fafafa` | Headings, important text |
| `--text-secondary` | `#a3a3a3` | Body text, table cells |
| `--text-muted` | `#525252` | Labels, placeholders, section headers |

### Typography
- **UI font:** Inter (loaded via Google Fonts in `index.css`)
- **Code font:** JetBrains Mono (SQL blocks, mono tags)
- **Heading sizes:** 36px (hero), 26px (page), 18px (card title), 14px (body)
- **Weight:** 400 regular, 500 medium, 600 semibold, 700 bold only

### Component Patterns

**Cards:**
```
bg-[#111111] border border-[#1e1e1e] rounded-[10px]
hover: border-[#2a2a2a] bg-[#131313]
```

**Buttons — Primary (amber):**
```
bg-amber-400 text-[#0a0a0a] hover:bg-amber-300
rounded-[6px] h-9 px-4 text-[13px] font-medium
```

**Buttons — Secondary (outline):**
```
border border-[#262626] text-[#fafafa] hover:bg-[#1a1a1a]
rounded-[6px] h-9 px-4 text-[13px] font-medium
```

**Inputs:**
```
bg-[#111111] border border-[#1e1e1e] text-[#fafafa]
placeholder-[#525252] rounded-[8px] px-4 py-3
focus:outline-none focus:border-[#404040]
```

**Section labels:**
```
text-[11px] font-semibold uppercase tracking-wider text-[#525252]
```

**Amber accent dot (used in Query Logic, section markers):**
```
w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0
```

### Rules
- No `dark:` prefixed classes anywhere
- No `bg-white`, `bg-slate-*`, `text-gray-*` — these are light mode remnants
- No gradients (`bg-gradient-*`, `from-*`, `to-*`)
- No glow shadows (`shadow-amber-*`, `shadow-indigo-*`)
- No glassmorphism (`backdrop-blur`, translucent card backgrounds)
- All transitions: `duration-150` maximum
- Border radius: `rounded-[4px]` tags, `rounded-[6px]` buttons, `rounded-[8px]` inputs, `rounded-[10px]` cards

---

## Session Management

Every browser tab gets a unique `session_id` generated by `useSession.ts` and stored in `localStorage` as `ai_hub_session_id`.

Every API request includes `X-Session-ID: {session_id}` header (injected by `api.ts` interceptor).

The backend uses this to scope:
- ChromaDB collections (audit)
- FAISS indexes (news)
- Chat history (news, stored in Redis)
- Uploaded files (data)
- Audit results cache (audit)
- Database connections (data)

**To clear a broken session:** Delete `ai_hub_session_id` from browser localStorage. The next page load generates a fresh session ID.

---

## API Structure

All backend routes follow this pattern:

```
/health                          ← Health check (no auth)
/agents/audit/*                  ← Audit agent endpoints
/agents/news/*                   ← News agent endpoints
/agents/data/*                   ← TalkToData endpoints
```

All agent endpoints require `X-Session-ID` header. Missing session ID returns 400.

CORS is configured in `main.py` to allow requests from:
- `http://localhost:5173` (local dev)
- `https://ai-hub-orpin-six.vercel.app` (production)

When adding a new deployment URL, update CORS origins in `main.py`.

---

## Environment Variables — Complete Reference

```env
# REQUIRED — app will not start without these
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...

# MODELS — change only if upgrading/downgrading
CLAUDE_MODEL=claude-sonnet-4-5
CLAUDE_VISION_MODEL=claude-opus-4-5
EMBEDDING_MODEL=voyage-3

# SERVER
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
FRONTEND_PORT=5173

# REDIS — required for sessions
REDIS_URL=redis://localhost:6379   # Local
# REDIS_URL=redis://default:...@redis.railway.internal:6379  # Railway

# STORAGE — auto-created on first run
VECTOR_STORE_PATH=./storage/vector_stores
UPLOADS_PATH=./storage/uploads
EXPORTS_PATH=./storage/exports

# AUDIT AGENT TUNING
AUDIT_CHUNK_SIZE=1000      # Characters per chunk
AUDIT_CHUNK_OVERLAP=200    # Overlap between chunks
AUDIT_RETRIEVAL_K=12       # Chunks retrieved per rule

# NEWS AGENT TUNING
NEWS_CHUNK_SIZE=1000
NEWS_CHUNK_OVERLAP=150
```

**Frontend env (Vercel):**
```env
VITE_API_URL=https://ai-hub-production-dc3a.up.railway.app
```
This is baked into the build at compile time by Vite. Changing it requires a redeploy.

---

## Deployment — Step by Step

### Local Development
```bash
# Terminal 1 — Backend
cd ai-hub/backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd ai-hub/frontend
npm install
npm run dev
# Opens at http://127.0.0.1:5173
```
Redis must be running locally (Memurai on Windows, redis-server on Mac/Linux).

### Production Deploy
```bash
# Any push to main triggers auto-deploy on both Railway and Vercel
git add .
git commit -m "your message"
git push
```

**Railway (backend):**
- Root directory: `backend/`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Required env vars: `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `REDIS_URL`
- Redis: add Railway Redis plugin — it auto-sets `REDIS_URL`

**Vercel (frontend):**
- Root directory: `frontend/`
- Framework preset: Vite (auto-detected)
- Required env var: `VITE_API_URL=https://ai-hub-production-dc3a.up.railway.app`
- `vercel.json` in `frontend/` handles SPA routing (all paths → index.html)

---

## How to Add a New Agent — 6 Steps

### Step 1 — Backend: Create agent folder
```
backend/agents/{id}/
├── __init__.py
├── router.py     # APIRouter, prefix="/agents/{id}"
├── schemas.py    # Pydantic v2 models
└── agent.py      # Core logic
```
All LLM calls via `from core.llm_client import call_claude`.
All config via `from core.config import settings`.

### Step 2 — Mount router in `backend/main.py`
```python
from agents.{id}.router import router as {id}_router
app.include_router({id}_router, prefix="/agents/{id}", tags=["{Name}"])
```

### Step 3 — Backend registry in `backend/core/registry.py`
```python
"{id}": {"name": "{Name}", "router_prefix": "/agents/{id}"}
```

### Step 4 — Frontend: Create agent component folder
```
frontend/src/agents/{id}/
└── {Name}Agent.tsx
```

### Step 5 — Register in `frontend/src/lib/agentRegistry.ts`
```typescript
{
  id: '{id}',
  name: '{Display Name}',
  tagline: '...',
  description: '...',
  instructions: '...',
  howItWorks: '...',
  icon: '{LucideIconName}',
  route: '/agent/{id}',
  status: 'active',
  tags: [...],
}
```

### Step 6 — Wire into `frontend/src/pages/AgentPage.tsx`
```tsx
const agentComponents: Record<string, JSX.Element> = {
  audit: <AuditAgent />,
  news: <NewsAgent />,
  data: <DataAgent />,
  {id}: <{Name}Agent />,
};
```
Dashboard and Sidebar update automatically from the registry.

### Step 7 — Create SKILL.md for the new agent
```
backend/agents/{id}/SKILL.md
```
Document: what it does, key files, pipeline flow, prompt rules, common bugs, what not to do, how to extend.

---

## Common Platform-Level Bugs

**Bug: 404 on page refresh in production**
Cause: `vercel.json` missing or in wrong location (must be in `frontend/`, not repo root).
Fix: Ensure `frontend/vercel.json` contains `{"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]}`

**Bug: API calls going to `/api/...` instead of Railway URL**
Cause: `VITE_API_URL` not set in Vercel environment variables, falling back to `/api`.
Fix: Add `VITE_API_URL=https://ai-hub-production-dc3a.up.railway.app` in Vercel project settings, then redeploy.

**Bug: Session not persisting between page navigations**
Cause: `ai_hub_session_id` missing from localStorage (cleared, private browsing, or first visit).
Fix: `useSession.ts` generates a new ID automatically. If sessions are broken, clear localStorage and refresh.

**Bug: Railway backend can't connect to user's local PostgreSQL**
Cause: Railway server cannot reach `localhost` on the user's machine.
Fix: This is expected. Users need a cloud PostgreSQL (Supabase, Neon, etc.) for production use.

**Bug: Voyage API rate limit (3 RPM on free tier)**
Cause: Free VoyageAI account is limited to 3 requests per minute.
Fix: Add billing card to VoyageAI account to unlock higher limits. This affects audit (embedding documents) and news (embedding articles).

**Bug: CORS error on new deployment URL**
Cause: New Vercel/Railway URL not added to CORS origins in `backend/main.py`.
Fix: Add the new URL to the `allow_origins` list in `main.py` and redeploy backend.

---

## Quick Reference

| Task | Where |
|---|---|
| Change LLM model | `core/config.py` → `CLAUDE_MODEL` env var |
| Change embedding model | `core/config.py` → `EMBEDDING_MODEL` env var |
| Add new audit document format | `agents/audit/processors/document_extractor.py` |
| Change SQL LIMIT default | `agents/data/llm_service.py` → `get_sql()` prompt |
| Change audit retrieval depth | `.env` → `AUDIT_RETRIEVAL_K` |
| Add new agent | Follow 7-step process above |
| Update agent card on dashboard | `frontend/src/lib/agentRegistry.ts` |
| Change design tokens | `frontend/src/index.css` CSS variables |
| Add new CORS origin | `backend/main.py` → `allow_origins` list |
| Check backend health | `GET https://ai-hub-production-dc3a.up.railway.app/health` |
