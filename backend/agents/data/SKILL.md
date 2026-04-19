# TalkToData Engine — Skill File

> Read this entire file before touching any code in `backend/agents/data/` or `frontend/src/agents/data/`.

---

## What It Does

TalkToData is a natural language to SQL engine. Users connect a PostgreSQL database or upload an Excel/CSV file, describe what they want in plain English, and the agent generates validated SQL, executes it, and returns results with a plain-English explanation.

It is the most complex agent in AI Hub. It has three backend passes per query, a silent reviewer, schema-aware prompting, two database adapters, and a collapsible card UI with sortable results and CSV export.

---

## Key Files — What Each One Does

| File | Responsibility |
|---|---|
| `router.py` | All HTTP endpoints. Owns the orchestration of the three-pass pipeline. |
| `llm_service.py` | The three LLM methods: `get_sql()`, `review_sql()`, `get_explanation()`. Each is a standalone Claude call with its own prompt and temperature. |
| `db_connector.py` | Two adapters: `PostgreSQLConnector` and `SQLiteConnector`. Handles connections, schema extraction, and query execution. |
| `transpiler.py` | SQLGlot wrapper. Validates AST and pretty-prints SQL. Falls back gracefully on parse errors. |
| `schemas.py` | All Pydantic models: `PostgresConfig`, `ExcelUploadResponse`, `QueryResult`, `AskResponse`, `ExecuteRequest`, `PostgresMetadataRequest`. |

---

## Three-Pass SQL Pipeline — The Core Architecture

This is the most important thing to understand. Every user question goes through exactly three Claude calls before execution. Do not simplify, merge, or remove any pass.

```
User question + schema context
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASS 1: get_sql()                                              │
│  Model: claude-sonnet-4-5  │  Temperature: 0.0                 │
│                                                                 │
│  Input:  plain-English question + full schema (tables,          │
│          columns, types, sample values)                         │
│  Task:   generate syntactically correct SQL                     │
│  Output: raw SQL after clean_sql_output() strips markdown       │
│                                                                 │
│  Prompt enforces:                                               │
│  - Explicit column selection (no SELECT *)                      │
│  - LIMIT 10 on all SELECT queries                               │
│  - No unnecessary CTEs for simple queries                       │
│  - Correct date filtering patterns per dialect                  │
│  - Tie-safe aggregations for max/min/most queries               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASS 2: review_sql()   ← SILENT. User never sees this.        │
│  Model: claude-sonnet-4-5  │  Temperature: 0.0                 │
│                                                                 │
│  Input:  original question + schema + Pass 1 SQL               │
│  Persona: skeptical senior SQL analyst                          │
│  Task:   verify semantic correctness                            │
│  Output: JSON {"sql": "..."} — corrected or unchanged           │
│                                                                 │
│  Checks:                                                        │
│  1. Does the SQL answer what was actually asked?                │
│  2. Correct tables joined? No Cartesian products?               │
│  3. For most/highest/max: proper aggregation, not just LIMIT 1  │
│  4. CTEs complete? No missing WITH clauses?                     │
│  5. GROUP BY includes all non-aggregated columns?               │
│  6. WHERE conditions match the question intent?                 │
│  7. Dialect correct for target DB?                              │
│  8. Would this run without errors?                              │
│                                                                 │
│  On JSON parse error: falls back to Pass 1 SQL silently         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  SQLGlot Validation                                             │
│                                                                 │
│  Input:  Pass 2 SQL                                             │
│  Task:   AST parse + pretty print                               │
│  Output: formatted SQL or Pass 2 SQL on parse failure           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASS 3: get_explanation()                                      │
│  Model: claude-sonnet-4-5  │  Temperature: 0.1                 │
│                                                                 │
│  Input:  final validated SQL                                    │
│  Task:   classify complexity + write plain-English explanation  │
│  Output: plain text explanation (no markdown, no asterisks)     │
│                                                                 │
│  Complexity classification:                                     │
│  SIMPLE  → 1 table, no joins, no aggregations → 2-3 lines max  │
│  MEDIUM  → joins, filters, basic aggregations → 1 summary +    │
│            2-4 bullets                                          │
│  COMPLEX → CTEs, subqueries, window functions → 1 summary +    │
│            4-6 bullets                                          │
│                                                                 │
│  Bullet format: "- Label: explanation"                          │
│  Label becomes amber header in QueryWorkspace UI                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
        Return {sql, explanation, dialect}
        (review_sql output NEVER returned to user)
```

---

## SQL Generation Rules — Enforced via Prompt

These rules are in the `get_sql()` prompt. If you change the prompt, preserve all of these:

**1. No SELECT ***
Always select explicit columns relevant to the question. `SELECT *` causes performance issues and unstable UI when schema changes.

**2. LIMIT 10 default**
Every SELECT query must end with `LIMIT 10` unless the user explicitly asks for all records or specifies a different number. Unbounded queries can freeze the UI and crash small databases.

**3. No unnecessary CTEs**
Use CTEs (`WITH` clauses) only when:
- The same subquery is referenced more than once
- The query genuinely has multiple logical steps that benefit from naming
Never use CTEs for simple aggregations that can be written as a direct query.

**4. Date filtering patterns**
For SQLite: `strftime('%m', date_column) = '03'` (zero-padded string, NOT integer comparison)
For PostgreSQL: `EXTRACT(MONTH FROM date_column) = 3` OR date range `date_column >= '2023-03-01' AND date_column < '2023-04-01'`
Never use `CAST(STRFTIME(...) AS INTEGER)` — this breaks on some SQLite versions.

**5. Tie-safe aggregations**
For "most", "highest", "maximum", "least" queries: use proper aggregation with `HAVING` or subquery to handle ties. Never just `ORDER BY x DESC LIMIT 1` — this silently drops tied results.

**6. Explicit JOIN conditions**
Always specify JOIN type (INNER, LEFT, etc.) and ON condition. Never implicit joins (comma-separated tables in FROM) — they produce Cartesian products.

---

## clean_sql_output() — The SQL Cleaner

Located in `llm_service.py`. Called after `get_sql()` to strip Claude's reasoning text before passing to the reviewer.

**Why it exists:** Claude sometimes thinks out loud before giving the SQL. This cleaner finds the last valid SQL block in the response.

**How it works:**
1. Strip markdown fences (` ```sql ` and ` ``` `)
2. Find all positions where a SQL keyword starts a line (`WITH`, `SELECT`, `INSERT`, etc.)
3. Take the **last** match — this is Claude's final answer after any reconsideration
4. Walk backward from a `SELECT` start to include any preceding `WITH` clause (preserves CTEs)
5. Guardrail: if result doesn't start with a SQL keyword, log warning and use raw output

**Do not simplify this function.** The backward CTE walk is critical — removing it causes CTEs to be silently truncated, producing broken SQL that fails at execution.

---

## Database Adapters

### SQLite Adapter (Excel/CSV upload flow)
```
User uploads .xlsx/.csv
    → openpyxl reads file
    → Each sheet becomes a SQLite table
    → Stored in backend/storage/uploads/{session_id}/
    → SQLite connection string passed to query pipeline
    → Dialect: "sqlite"
```

### PostgreSQL Adapter (live DB flow)
```
User provides: host, port, database, username, password
    → psycopg2 connection attempt
    → List available tables
    → User selects tables to include in schema
    → fetch_postgres_metadata() extracts column names, types, sample values
    → Schema passed to query pipeline
    → Dialect: "postgresql"
```

**Critical:** PostgreSQL `host: localhost` will NEVER work when deployed on Railway. Railway's backend server cannot reach the user's local machine. Users need a cloud database (Supabase, Neon, Railway PostgreSQL, AWS RDS). This is not a bug — it is a fundamental networking constraint.

---

## Schema Format Passed to LLM

The schema context passed to `get_sql()` and `review_sql()` looks like this:

```
Table: orders
Columns:
  - order_id (INTEGER) — sample values: 1001, 1002, 1003
  - order_date (TEXT) — sample values: 2023-01-15, 2023-02-20
  - customer_id (INTEGER) — sample values: 5, 6, 7
  - revenue (REAL) — sample values: 25000.00, 18000.00

Table: customers
Columns:
  - customer_id (INTEGER) — sample values: 5, 6, 7
  - customer_name (TEXT) — sample values: Mohit Gupta, Neha Kapoor
  - region (TEXT) — sample values: North, South, East, West
```

Sample values are critical — they help Claude understand data formats (especially dates) and avoid incorrect WHERE conditions. Never strip sample values from the schema context to save tokens.

---

## Frontend — QueryWorkspace Architecture

Located at `frontend/src/agents/data/QueryWorkspace.tsx`. This is the most complex frontend component.

### State Management
```typescript
queryHistory    // Array of {question, sql, explanation, result, error}
collapsedCards  // Set<number> — indices of collapsed cards
sortCol         // string | null — column being sorted
sortDir         // 'asc' | 'desc'
isLoading       // boolean — query in progress
editMode        // boolean — SQL edit mode active
editedSql       // string — user-modified SQL
```

### Card Lifecycle
```
User submits question
    → All existing cards added to collapsedCards (auto-collapse)
    → New card appended to queryHistory (expanded by default)
    → API call: POST /agents/data/ask
    → Card populated with {sql, explanation}
    → User clicks Execute Query
    → API call: POST /agents/data/execute
    → Card populated with {result} or {error}

User clicks card header
    → toggleCard(index): add/remove from collapsedCards
    → NO re-execution — shows already-loaded data
```

### Layout Structure (Do Not Change Without Reading This)
```
QueryWorkspace (flex col, gap-4)
├── Query input bar (full width)
├── For each item in queryHistory:
│   └── Collapsible card (bg-[#0d0d0d], border)
│       ├── Card header (always visible, click to toggle)
│       │   ├── "Q." amber label + question text (truncated)
│       │   └── collapse/expand label + ChevronDown icon
│       └── Card body (hidden when collapsed)
│           ├── Side-by-side row (flex, gap-4, items-start)
│           │   ├── SQL card (flex-1) — code block + toolbar
│           │   └── Query Logic panel (w-[260px], fixed)
│           ├── Execute Query button (full width)
│           ├── Results table (full width) — sortable, CSV export
│           └── Error message (full width, only if error)
```

### SQL Toolbar Buttons
- **Copy SQL** — copies `editedSql` (or original sql) to clipboard, shows "Copied!" for 2s
- **Edit** — sets `editMode: true`, makes textarea editable, button turns amber
- **Reset** — resets `editedSql` to original generated SQL, exits edit mode, turns red on hover

### Results Table
- Columns: extracted from `result.columns` array
- Rows: from `result.rows` array (array of objects)
- Sortable: clicking column header sets `sortCol` and toggles `sortDir`
- CSV Export: pure browser JS — reads already-loaded data, no API call, zero token cost
- No re-fetch on sort — client-side sort only

---

## API Endpoints Reference

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/agents/data/parse-excel` | Upload Excel → create SQLite → return table list |
| POST | `/agents/data/list-postgres-tables` | Connect PostgreSQL → return table list |
| POST | `/agents/data/fetch-postgres-metadata` | Get column info for selected tables |
| POST | `/agents/data/finalize-metadata` | Store schema in session for query use |
| POST | `/agents/data/ask` | Run three-pass pipeline → return {sql, explanation} |
| POST | `/agents/data/execute` | Execute SQL against session DB → return {rows, columns} |

### PostgresConfig Schema (IMPORTANT)
Field name is `username` not `user`. This has caused 422 errors before.
```python
class PostgresConfig(BaseModel):
    host: str
    port: str
    database: str
    username: str   # NOT "user"
    password: str
```
Both frontend and backend must use `username`. Never change this back to `user`.

---

## Common Bugs and How to Avoid Them

**Bug: CTE gets truncated → SQL fails**
Cause: `clean_sql_output()` finds a `SELECT` inside the CTE body and treats it as the start.
Fix: The backward CTE walk in `clean_sql_output()` handles this. Never remove that logic.

**Bug: 422 on list-postgres-tables**
Cause: Frontend sending `user` instead of `username` in request body.
Fix: Always use `username` in `PostgresConfig` everywhere — frontend and backend.

**Bug: Reviewer output shown to user**
Cause: `review_notes` field added to API response.
Fix: Never return reviewer output. Response is always just `{sql, explanation, dialect}`.

**Bug: Date queries return wrong month**
Cause: Using `CAST(STRFTIME('%m', ...) AS INTEGER)` which is fragile.
Fix: Use `strftime('%m', date_column) = '03'` (string comparison, zero-padded).

**Bug: "Most orders" query returns wrong customer**
Cause: Using `ORDER BY COUNT(*) DESC LIMIT 1` which drops ties.
Fix: Use `HAVING COUNT(*) = (SELECT MAX(order_count) FROM ...)` pattern.

**Bug: Old query re-executes when user expands card**
Cause: Execute logic tied to card expansion instead of button click.
Fix: Execute Query button is the ONLY trigger for execution. Card expand/collapse is pure UI state.

---

## What Not To Do

- **Never merge the three passes into one** — the reviewer needs the generator's output as input. One combined prompt will not achieve the same quality.
- **Never return reviewer output to the user** — it is internal quality control only.
- **Never remove LIMIT 10** — unbounded queries will freeze the UI with large datasets.
- **Never use SELECT *** — always explicit columns.
- **Never auto-execute queries** — user must click Execute Query. Auto-run is dangerous for destructive or expensive queries.
- **Never assume localhost PostgreSQL works in production** — it doesn't on Railway.
- **Never strip sample values from schema context** — Claude needs them to understand date formats and data types.

---

## Extending TalkToData

**Add a new SQL dialect (e.g. MySQL):**
1. Add dialect detection in `db_connector.py`
2. Add MySQL connector class using `mysql-connector-python`
3. Update dialect-specific date filtering rules in `get_sql()` prompt
4. Update SQLGlot transpile call with `read="mysql", write="mysql"`
5. Add MySQL option to `ConnectionPanel.tsx`

**Add chart generation:**
1. In `get_explanation()`, add a field: classify if result is suitable for chart (`bar`, `line`, `pie`, or `none`)
2. Return `chart_type` in AskResponse schema
3. In `QueryWorkspace.tsx`, render a chart component below the results table when `chart_type !== 'none'`
4. Use recharts (already in package.json) — no new dependency needed

**Change LIMIT default:**
Edit one line in `get_sql()` prompt in `llm_service.py`:
`f"4. Always add LIMIT 10 at the end..."`
Change `10` to desired value.

**Add query history persistence:**
Currently query history lives in React state — lost on page refresh.
To persist: save `queryHistory` to Redis on each new query, load on component mount.
Use session ID as key: `data:history:{session_id}`.
