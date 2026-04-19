# Parses a user-uploaded CSV containing audit questions.
# Returns a list of rule dicts compatible with conduct_audit().

from __future__ import annotations

import re

from core.logger import get_logger

logger = get_logger("audit.questions_parser")

# Common English stop words to exclude from keyword extraction
_STOP_WORDS = frozenset({
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need",
    "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "about", "into", "through", "that", "this", "these", "those",
    "it", "its", "if", "and", "or", "but", "not", "any", "all",
    "each", "every", "both", "few", "more", "most", "whether",
    "there", "their", "they", "we", "you", "he", "she",
    "also", "such", "than", "then", "as", "what", "which",
    "who", "when", "where", "how", "why", "so", "yet", "no",
    "get", "put", "set", "let", "use", "used", "per", "one",
    "two", "new", "old", "our", "your", "his", "her",
})


def _extract_keywords(text: str, max_keywords: int = 6) -> list[str]:
    """Extract top N meaningful words from a question string."""
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    seen: set[str] = set()
    keywords: list[str] = []
    for word in words:
        if word not in _STOP_WORDS and word not in seen:
            seen.add(word)
            keywords.append(word)
        if len(keywords) >= max_keywords:
            break
    return keywords


def parse_questions_csv(file_path: str) -> list[dict]:
    """
    Read a CSV file and extract audit questions.

    Requirements:
    - Must contain a column named exactly 'Questions'
    - Empty rows are skipped
    - Optional 'Criticality' column (defaults to 'High')

    Returns:
        list of dicts: {rule: str, keywords: list[str], criticality: str}

    Raises:
        ValueError with a user-friendly message for:
        - Malformed CSV
        - Missing 'Questions' column
        - No valid questions after cleaning
    """
    try:
        import pandas as pd
        df = pd.read_csv(file_path)
    except Exception as exc:
        raise ValueError(
            "Could not parse the uploaded file as CSV. Please check the file format."
        ) from exc

    if "Questions" not in df.columns:
        found = ", ".join(str(c) for c in df.columns)
        raise ValueError(
            f"Invalid format: CSV must contain a column named exactly 'Questions'. "
            f"Found columns: {found}"
        )

    has_criticality = "Criticality" in df.columns
    questions: list[dict] = []

    for _, row in df.iterrows():
        raw = str(row["Questions"]).strip()
        if not raw or raw.lower() == "nan":
            continue

        if has_criticality:
            crit_raw = str(row["Criticality"]).strip()
            criticality = (
                "High"
                if not crit_raw or crit_raw.lower() == "nan"
                else crit_raw
            )
        else:
            criticality = "High"

        questions.append(
            {
                "rule": raw,
                "keywords": _extract_keywords(raw),
                "criticality": criticality,
            }
        )

    if not questions:
        raise ValueError(
            "No valid questions found in the uploaded file. "
            "Ensure the Questions column is not empty."
        )

    logger.info(f"questions_parsed count={len(questions)} file={file_path}")
    return questions
