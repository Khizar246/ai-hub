# NL-to-SQL accuracy eval: runs the real TalkToData pipeline (get_sql →
# review_sql → validate) against evals/fixture.db and scores each case by
# comparing the generated query's result set to the golden query's, order-
# insensitively. Requires a real ANTHROPIC_API_KEY; costs a few cents per run.
#
# Usage (from ai-hub/backend, venv active):
#   python -m evals.run_eval                 # full pipeline, all cases
#   python -m evals.run_eval --no-review     # skip the review pass (faster)
#   python -m evals.run_eval --cases simple-filter,date-month
#   python -m evals.run_eval --verbose       # print generated SQL and diffs

import argparse
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agents.data import llm_service, transpiler  # noqa: E402
from evals.fixture import COLUMN_DESCRIPTIONS, FIXTURE_PATH, build_fixture  # noqa: E402

DATASET_PATH = Path(__file__).parent / "dataset.json"


def build_schema_text(conn: sqlite3.Connection) -> str:
    """Mirror the /finalize-metadata schema format: columns + descriptions + samples."""
    cur = conn.cursor()
    tables = [
        row[0]
        for row in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
    ]
    parts = []
    samples = []
    for table in tables:
        cols = cur.execute(f'PRAGMA table_info("{table}")').fetchall()
        col_lines = []
        for _, name, col_type, *_ in cols:
            desc = COLUMN_DESCRIPTIONS.get(table, {}).get(name, "")
            line = f"  - {name} ({col_type or 'TEXT'})"
            if desc:
                line += f": {desc}"
            col_lines.append(line)
        parts.append(f"Table: {table}\nColumns:\n" + "\n".join(col_lines))

        rows = cur.execute(f'SELECT * FROM "{table}" LIMIT 3').fetchall()
        header = " | ".join(c[1] for c in cols)
        lines = [" | ".join(str(v) for v in row) for row in rows]
        samples.append(f"{table}:\n{header}\n" + "\n".join(lines))

    return (
        "\n\n".join(parts)
        + "\n\n### SAMPLE DATA (first rows per table)\n"
        + "\n\n".join(samples)
    )


def normalize(rows: list[tuple]) -> list[tuple]:
    """Order-insensitive, float-tolerant canonical form of a result set."""

    def canon(value):
        if isinstance(value, float):
            return round(value, 4)
        return value

    return sorted(tuple(canon(v) for v in row) for row in rows)


def run_case(
    case: dict, schema_text: str, conn: sqlite3.Connection, use_review: bool, verbose: bool
) -> tuple[bool, str]:
    question = case["question"]
    sql = llm_service.get_sql(schema_text, question, "sqlite")
    if use_review:
        sql = llm_service.review_sql(question, schema_text, sql, "sqlite")
    sql = transpiler.validate_and_format_sql(sql, "sqlite")

    try:
        transpiler.assert_read_only(sql, "sqlite")
        generated = conn.execute(sql).fetchall()
    except Exception as exc:
        return False, f"generated SQL failed to execute: {exc}\n{sql}"

    expected = conn.execute(case["expected_sql"]).fetchall()
    if normalize(generated) == normalize(expected):
        return True, sql
    detail = f"result mismatch\n--- generated SQL ---\n{sql}"
    if verbose:
        detail += f"\n--- generated rows ---\n{normalize(generated)}"
        detail += f"\n--- expected rows ---\n{normalize(expected)}"
    return False, detail


def main() -> int:
    parser = argparse.ArgumentParser(description="TalkToData NL-to-SQL accuracy eval")
    parser.add_argument("--no-review", action="store_true", help="skip the review_sql pass")
    parser.add_argument("--cases", default="", help="comma-separated case ids to run")
    parser.add_argument("--verbose", action="store_true", help="print SQL and row diffs")
    args = parser.parse_args()

    build_fixture()
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    cases = dataset["cases"]
    if args.cases:
        wanted = {c.strip() for c in args.cases.split(",")}
        cases = [c for c in cases if c["id"] in wanted]

    conn = sqlite3.connect(FIXTURE_PATH)
    schema_text = build_schema_text(conn)

    passed = 0
    failures: list[str] = []
    for case in cases:
        ok, detail = run_case(case, schema_text, conn, not args.no_review, args.verbose)
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {case['id']}")
        if ok:
            passed += 1
            if args.verbose:
                print(f"  {detail.splitlines()[0]}")
        else:
            failures.append(f"{case['id']}: {detail}")

    conn.close()
    total = len(cases)
    accuracy = passed / total * 100 if total else 0.0
    print(f"\nAccuracy: {passed}/{total} ({accuracy:.0f}%)")
    if failures:
        print("\nFailures:")
        for f in failures:
            print(f"\n{f}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
