# Claude vision API: extract text from scanned/image-heavy PDF pages.

from __future__ import annotations

from agents.audit.processors.pdf_extractor import PageResult
from core.llm_client import call_claude_vision
from core.logger import get_logger

logger = get_logger("audit.vision_extractor")

VISION_PROMPT = """You are a document extraction assistant. The image below is a single page
from a project document (e.g. an audit report, compliance policy, or technical specification).

Extract ALL readable text from this page. Preserve the logical structure:
- Use markdown headings for section titles
- Render tables in markdown format
- Preserve bullet points and numbered lists
- If you see a RACI chart or responsibility matrix, extract it as a markdown table
- If you see an org chart or diagram, describe its structure in plain text

Return only the extracted content — no commentary, no preamble."""


async def extract_vision_pages(pages: list[PageResult]) -> list[PageResult]:
    """
    For every PageResult where needs_vision=True, call Claude vision to extract text.
    Returns the same list with vision_text merged into the .text field.
    Non-vision pages are returned unchanged.
    """
    import asyncio

    updated: list[PageResult] = []

    for page in pages:
        if not page.needs_vision or not page.image_bytes:
            updated.append(page)
            continue

        logger.info(f"vision_extraction_start page={page.page_num}")

        try:
            vision_text = await asyncio.to_thread(
                call_claude_vision,
                page.image_bytes,
                VISION_PROMPT,
            )
            # Merge: keep any pdfplumber text (rare) + vision output
            merged = "\n\n".join(filter(None, [page.text, vision_text])).strip()
            updated.append(
                PageResult(
                    page_num=page.page_num,
                    text=merged,
                    tables=page.tables,
                    image_bytes=page.image_bytes,
                    needs_vision=False,  # already processed
                )
            )
            logger.info(f"vision_extraction_done page={page.page_num} chars={len(merged)}")
        except Exception as exc:
            logger.error(f"vision_extraction_failed page={page.page_num} error={exc}")
            # Keep the original (possibly empty) page rather than crashing the pipeline
            updated.append(page)

    return updated
