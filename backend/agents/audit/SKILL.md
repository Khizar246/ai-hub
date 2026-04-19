# AI Audit Agent — Skill File

> Read this entire file before touching any code in `backend/agents/audit/` or `frontend/src/agents/audit/`.

---

## What It Does

The AI Audit Agent accepts document uploads (PDF, DOCX, PPTX, XLSX, CSV) and a CSV of custom audit questions. It runs each question against the document using a HyDE-enhanced RAG pipeline built on LangGraph, then produces a structured compliance report with confidence scores, page references, and an Excel export.

It is the second most complex agent in AI Hub. It has a dual-layer PDF extraction system, session-scoped ChromaDB vector stores, concurrent batch processing, and a multi-node LangGraph evaluation graph.

---

## Key Files — What Each One Does

| File | Responsibility |
|---|---|
| `router.py` | All HTTP endpoints. Manages session lifecycle and orchestrates the pipeline. |
| `schemas.py` | AuditResult, AuditResponse, UploadResponse, ProcessResponse |
| `processors/pdf_extractor.py` | Dual-layer extraction: pdfplumber for digital pages, PyMuPDF fallback for image pages |
| `processors/vision_extractor.py` | Sends image-based pages to claude-opus-4-5 vision for content extraction |
| `processors/embedder.py` | Chunks text and builds session-scoped ChromaDB vector store |
| `processors/document_extractor.py` | Routes non-PDF formats (DOCX, PPTX, XLSX, CSV) to appropriate parsers |
| `processors/questions_parser.py` | Parses and validates the user-uploaded audit questions CSV |
| `agents/audit_agent.py` | LangGraph graph: retrieve → evaluate → verify, runs per audit rule |
| `agents/hyde_retriever.py` | HyDE implementation: generates hypothetical compliant paragraph as search query |
| `agents/rules.py` | AUDIT_PROMPT_TEMPLATE — the core evaluation prompt |
| `agents/verifier.py` | Parses and validates structured LLM output |

---

## Full Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Document Upload & Extraction                          │
│                                                                 │
│  User uploads document(s)                                       │
│      → document_extractor.py routes by file type:              │
│          PDF  → pdf_extractor.py (dual-layer, see below)        │
│          DOCX → python-docx parser                              │
│          PPTX → python-pptx parser                              │
│          XLSX → openpyxl parser                                 │
│          CSV  → pandas reader                                   │
│      → Raw text extracted per page/slide/sheet                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Embedding                                             │
│                                                                 │
│  embedder.py                                                    │
│      → Chunk text (AUDIT_CHUNK_SIZE=1000, OVERLAP=200)         │
│      → Each chunk tagged with: source file, page number         │
│      → VoyageAI voyage-3 embedding                              │
│      → Store in ChromaDB collection named: session_{session_id} │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Audit Questions Upload                                │
│                                                                 │
│  User uploads CSV with "Questions" column                       │
│      → questions_parser.py validates column existence           │
│      → Returns question list + preview (first 3)               │
│      → Questions stored in session via Redis                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: LangGraph Audit Pipeline                              │
│                                                                 │
│  For each audit question (batches of 5, concurrent):            │
│                                                                 │
│  Node 1: hyde_retriever.py                                      │
│      → Calls Claude: "Write a paragraph showing this rule       │
│         is compliant in a real document"                        │
│      → Uses that hypothetical paragraph as the ChromaDB         │
│         search query (NOT the original question)                │
│      → Retrieves top AUDIT_RETRIEVAL_K=12 chunks                │
│                                                                 │
│  Node 2: audit_agent.py (evaluate)                              │
│      → Builds prompt: rule + retrieved chunks                   │
│      → Uses AUDIT_PROMPT_TEMPLATE from rules.py                 │
│      → Calls Claude: evaluate compliance                         │
│      → Returns structured JSON response                         │
│                                                                 │
│  Node 3: verifier.py                                            │
│      → Parses LLM JSON output                                   │
│      → Validates all required fields present                    │
│      → Normalizes status values                                 │
│      → Falls back to "Not Present" with error note on failure   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5: Export                                                │
│                                                                 │
│  Results compiled into list of AuditResult objects              │
│      → Stored in Redis: audit:results:{session_id}              │
│      → Excel export via openpyxl:                               │
│          Sheet 1: Summary (status counts, overall score)        │
│          Sheet 2: Detailed results (all fields per question)    │
│      → Saved to storage/exports/{session_id}/report.xlsx        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dual-Layer PDF Extraction — Critical Detail

This is the most important piece of the audit agent. Do not simplify it.

```
For each page in PDF:
    Step 1: pdfplumber extracts text
    Step 2: If extracted text < 100 characters:
        → Page is likely image-based (scanned, screenshot, chart)
        → PyMuPDF renders page as PNG at 2x resolution
        → vision_extractor.py sends PNG to claude-opus-4-5
        → Claude extracts: text content, table data, diagram descriptions
    Step 3: Combine digital + vision-extracted text
```

**Why the 100-character threshold?**
Digital PDF pages almost always have more than 100 chars of extractable text. Pages with fewer are almost certainly image-only. This threshold was chosen empirically — lowering it causes false positives (sending digital pages to vision unnecessarily, wasting tokens). Raising it misses some image pages. Do not change it without testing.

**Why claude-opus-4-5 for vision (not sonnet)?**
Opus has significantly better performance on complex visual content like RACI charts, org diagrams, and dense tables. Sonnet sometimes misses table structure and cell relationships. The token cost is justified for audit accuracy.

**What vision extraction handles:**
- Scanned/photographed documents
- RACI charts and org diagrams
- Tables embedded as images
- Handwritten sections (limited)
- Flowcharts and process diagrams

---

## HyDE Retrieval — Why It Exists and Why Not To Remove It

**Standard RAG problem:** Searching ChromaDB with the audit question text ("Does the document describe a data migration strategy?") retrieves chunks that are semantically similar to the question — but the question is abstract, not concrete. Document text is concrete and specific.

**HyDE solution:** Instead of searching with the question, Claude first generates a hypothetical paragraph that would appear in a compliant document:

```
Question: "Does the document describe a data migration strategy?"

HyDE generates: "The organization will execute data migration in three 
phases: extraction from legacy systems, transformation to the new schema, 
and validation via checksums. A rollback procedure is defined for each 
phase with a maximum downtime window of 4 hours..."

ChromaDB search: uses THIS paragraph as the query vector
```

This retrieves chunks that look like compliance evidence — exactly what the evaluator needs.

**Never replace HyDE with direct question embedding.** Testing shows a significant drop in recall for audit-style questions. The hypothetical paragraph bridges the semantic gap between abstract compliance questions and concrete document language.

---

## Batch Processing — Rate Limits and Concurrency

Rules are evaluated in **batches of 5 concurrently** using `asyncio.gather()`.

**Why 5?**
Each rule evaluation involves 2 Claude calls (HyDE + evaluation). Batch of 5 = 10 concurrent Claude calls. This is the empirically determined safe limit before hitting Anthropic rate limits on the claude-sonnet-4-5 tier. Increasing to 10 will cause rate limit errors on documents with many audit questions.

**Do not increase the batch size** without first upgrading the Anthropic API tier.

**What happens on rate limit error:**
The batch catches the exception, logs it, and marks the affected rule as "Not Present" with an error observation. The audit continues for remaining rules. This is intentional — partial results are better than a full failure.

---

## ChromaDB Session Scoping

Each audit session gets its own ChromaDB collection: `session_{session_id}`.

**Lifecycle:**
- Created: when `process-dynamic` endpoint is called
- Persists: in `storage/vector_stores/` during the session
- Cleared: when `DELETE /agents/audit/clear/{session_id}` is called, or on session expiry

**What happens if session expires mid-audit?**
The ChromaDB collection still exists on disk — it is not tied to Redis TTL. The audit can still complete. However, the results stored in Redis will be lost if Redis TTL expires. In production (Railway), Redis is persistent so this is less of a concern.

**Never share ChromaDB collections between sessions.** Each upload gets its own isolated vector store. Cross-session contamination would corrupt audit results.

---

## AUDIT_RETRIEVAL_K — The Retrieval Depth Setting

Default: `AUDIT_RETRIEVAL_K=12` (set in `.env`)

This controls how many chunks are retrieved from ChromaDB per audit rule.

**Why 12?**
- Too low (< 6): misses evidence spread across multiple pages
- Too high (> 20): exceeds Claude's effective context window for evaluation, causes confusion
- 12 is the empirical sweet spot for typical audit documents (20-100 pages)

**When to increase:** Very long documents (200+ pages) where evidence for a single rule might be scattered across many sections. Increase to 16-20.

**When to decrease:** Short documents (< 10 pages) where 12 chunks might include irrelevant content. Decrease to 6-8.

---

## AuditResult Schema — Output Per Rule

```python
class AuditResult(BaseModel):
    rule: str                    # The original audit question
    status: str                  # "Present" | "Partially Present" | "Not Present"
    observation: str             # What was found (or not found) in the document
    recommendation: str          # What should be done to address gaps
    risk: str                    # Risk if this gap is not addressed
    confidence_score: float      # 0.0 - 1.0 — how confident Claude is
    criticality: str             # "High" | "Medium" | "Low"
    page_numbers: list[int]      # Pages where evidence was found
```

**StatusPill colors — Do Not Change:**
- Present → green (`bg-green-500/10 text-green-400 border-green-500/20`)
- Partially Present → amber (`bg-amber-500/10 text-amber-400 border-amber-500/20`)
- Not Present → red (`bg-red-500/10 text-red-400 border-red-500/20`)

These are semantic colors with specific meaning. They must never be changed to match a theme update.

---

## Questions CSV Format

The uploaded CSV must have a column named exactly `Questions` (capital Q).

```csv
Questions
Does the document describe a data migration strategy?
Is there a defined rollback procedure?
Are data owners identified for each system?
```

**What `questions_parser.py` validates:**
- File is valid CSV
- `Questions` column exists (case-sensitive)
- At least 1 question present
- No empty question rows

**On validation failure:** Returns `{valid: false, error: "..."}`. Frontend shows red error state on the CSV dropzone. User must fix and re-upload.

---

## Excel Export Format

Generated by openpyxl. Two sheets:

**Sheet 1 — Summary:**
- Total questions evaluated
- Count per status (Present / Partially Present / Not Present)
- Overall compliance score (Present + 0.5 × Partially Present) / Total
- High criticality gaps count

**Sheet 2 — Detailed Results:**
Columns (in order): Question, Status, Observation, Recommendation, Risk, Confidence Score, Criticality, Page Numbers

Saved to: `storage/exports/{session_id}/audit_report.xlsx`
Served via: `POST /agents/audit/export`

---

## Common Bugs and How to Avoid Them

**Bug: Password-protected PDF causes silent failure**
Cause: pdfplumber cannot open encrypted PDFs. It raises an exception that gets caught silently.
Fix: Add explicit password check in `pdf_extractor.py` before extraction. Return a user-friendly error if the PDF is encrypted.

**Bug: Corrupted file causes entire audit to fail**
Cause: Exception during extraction propagates up and aborts the session.
Fix: Wrap per-file extraction in try/catch. Skip corrupted files with a warning in the results rather than aborting.

**Bug: Audit questions with special characters cause CSV parse errors**
Cause: Questions containing commas or quotes break naive CSV parsing.
Fix: Always use `pandas.read_csv()` with `quoting=csv.QUOTE_ALL` — already implemented. Never switch to manual CSV splitting.

**Bug: ChromaDB collection grows unbounded across sessions**
Cause: `clear` endpoint not called after session ends.
Fix: The frontend calls `DELETE /agents/audit/clear/{session_id}` when the user resets. For abandoned sessions, implement a cleanup job in production.

**Bug: Vision extraction doubles content on mixed pages**
Cause: A page has both extractable text AND an image. pdfplumber gets the text, then the page falls through to vision which re-extracts the same text plus the image.
Fix: Only fall through to vision if text length < 100 chars. Do not combine pdfplumber and vision output for the same page.

**Bug: HyDE generates a hypothetical that is too generic**
Cause: Audit question is vague (e.g. "Is the document complete?").
Fix: This is expected behavior for vague questions. HyDE still outperforms direct search. Do not add special handling for vague questions.

---

## What Not To Do

- **Never remove the dual-layer PDF extraction** — single-layer misses 30-40% of content in real-world audit documents
- **Never replace HyDE with direct question embedding** — recall drops significantly for abstract compliance questions
- **Never increase batch size beyond 5** without upgrading API tier
- **Never share ChromaDB collections between sessions** — results will be contaminated
- **Never change StatusPill colors** — they are semantic, not decorative
- **Never change the 100-character vision fallback threshold** without testing on real documents
- **Never use claude-sonnet for vision extraction** — use claude-opus-4-5 as configured

---

## Extending the Audit Agent

**Add a new document format (e.g. .msg email files):**
1. Add parser in `processors/document_extractor.py`
2. Add the file extension to the accepted types list in `router.py`
3. Add the extension to the FileDropzone accepted types in `frontend/src/agents/audit/DynamicUploadStep.tsx`

**Add a new audit output field (e.g. regulatory_reference):**
1. Add field to `AuditResult` in `schemas.py`
2. Add the field to `AUDIT_PROMPT_TEMPLATE` in `rules.py` — instruct Claude to populate it
3. Add the field to `verifier.py` validation
4. Add the column to the Excel export in the router
5. Add the field to `ResultsPanel.tsx` in the frontend

**Improve recall for very long documents:**
1. Increase `AUDIT_RETRIEVAL_K` in `.env` to 16-20
2. Consider adding a re-ranking step after ChromaDB retrieval
3. Consider splitting very long documents into sections and running per-section audits

**Add multi-document audit (audit against multiple documents simultaneously):**
Currently one ChromaDB collection per session holds all uploaded documents.
Multiple documents already work — just upload them all before processing.
The embedder tags each chunk with its source filename for citation purposes.
