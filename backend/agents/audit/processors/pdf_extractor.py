# Dual-layer PDF extraction: pdfplumber for text/tables, PyMuPDF for image rendering.

from __future__ import annotations

import io
from dataclasses import dataclass, field

import fitz  # PyMuPDF
import pdfplumber

from core.logger import get_logger

logger = get_logger("audit.pdf_extractor")

MIN_TEXT_CHARS = 100  # pages with fewer chars are sent to vision


@dataclass
class PageResult:
    page_num: int          # 1-based
    text: str
    tables: list[str]      # each table rendered as markdown
    image_bytes: bytes     # PNG of the full page (always populated)
    needs_vision: bool     # True when pdfplumber returned < MIN_TEXT_CHARS


def _table_to_markdown(table: list[list[str | None]]) -> str:
    """Convert a pdfplumber table (list of rows) into a markdown table string."""
    if not table or not table[0]:
        return ""

    def clean(cell: str | None) -> str:
        return str(cell).replace("\n", " ").strip() if cell is not None else ""

    rows = [[clean(c) for c in row] for row in table]
    header = rows[0]
    body = rows[1:]

    col_widths = [max(len(h), 3) for h in header]
    for row in body:
        for i, cell in enumerate(row):
            if i < len(col_widths):
                col_widths[i] = max(col_widths[i], len(cell))

    def fmt_row(row: list[str]) -> str:
        cells = []
        for i, cell in enumerate(row):
            width = col_widths[i] if i < len(col_widths) else 3
            cells.append(cell.ljust(width))
        return "| " + " | ".join(cells) + " |"

    separator = "| " + " | ".join("-" * w for w in col_widths) + " |"

    lines = [fmt_row(header), separator]
    for row in body:
        padded = row + [""] * (len(header) - len(row))
        lines.append(fmt_row(padded))

    return "\n".join(lines)


def _render_page_png(fitz_page: fitz.Page, dpi: int = 150) -> bytes:
    """Render a PyMuPDF page to PNG bytes at the given DPI."""
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    pix = fitz_page.get_pixmap(matrix=mat, alpha=False)
    return pix.tobytes("png")


def extract_pages(pdf_bytes: bytes) -> list[PageResult]:
    """
    Extract content from every page of a PDF.

    Layer 1 — pdfplumber: digital text + table extraction.
    Layer 2 — PyMuPDF:    render each page as a PNG (always done so vision
                           extractor can use it without re-opening the file).

    Returns a list of PageResult (one per page, 1-based page_num).
    """
    results: list[PageResult] = []

    pdf_stream = io.BytesIO(pdf_bytes)
    fitz_doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    with pdfplumber.open(pdf_stream) as plumber_doc:
        for page_idx, plumber_page in enumerate(plumber_doc.pages):
            page_num = page_idx + 1

            # --- Layer 1: pdfplumber text + tables ---
            raw_text: str = plumber_page.extract_text() or ""
            text = raw_text.strip()

            tables_md: list[str] = []
            try:
                raw_tables = plumber_page.extract_tables() or []
                for tbl in raw_tables:
                    md = _table_to_markdown(tbl)
                    if md:
                        tables_md.append(md)
            except Exception as exc:
                logger.warning(f"table_extraction_failed page={page_num} error={exc}")

            # --- Layer 2: PyMuPDF PNG render ---
            fitz_page = fitz_doc[page_idx]
            try:
                image_bytes = _render_page_png(fitz_page)
            except Exception as exc:
                logger.warning(f"page_render_failed page={page_num} error={exc}")
                image_bytes = b""

            needs_vision = len(text) < MIN_TEXT_CHARS

            results.append(
                PageResult(
                    page_num=page_num,
                    text=text,
                    tables=tables_md,
                    image_bytes=image_bytes,
                    needs_vision=needs_vision,
                )
            )

            logger.info(f"page_extracted page={page_num} chars={len(text)} tables={len(tables_md)} needs_vision={needs_vision}")

    fitz_doc.close()
    return results
