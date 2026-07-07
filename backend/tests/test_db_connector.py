# Identifier safety, dtype mapping, path-traversal guard, and end-to-end
# Excel/CSV → SQLite parsing (uses real pandas + sqlite, no external services).

import io

import pandas as pd
import pytest

from agents.data import db_connector
from agents.data.db_connector import (
    _dedupe_names,
    _sanitize_identifier,
    _sql_type_for,
    fetch_sample_rows,
    parse_excel_to_sqlite,
    quote_identifier,
)
from core.config import settings
from core.exceptions import DatabaseConnectionError

SESSION = "123e4567-e89b-42d3-a456-426614174000"


@pytest.fixture(autouse=True)
def uploads_in_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOADS_PATH", str(tmp_path))


class TestIdentifiers:
    def test_sanitize_spaces_and_specials(self):
        assert _sanitize_identifier("Q1 Sales!") == "Q1_Sales"

    def test_sanitize_leading_digit_prefixed(self):
        assert _sanitize_identifier("2024 data") == "t_2024_data"

    def test_sanitize_empty_falls_back(self):
        assert _sanitize_identifier("!!!") == "unnamed"

    def test_dedupe_case_insensitive(self):
        assert _dedupe_names(["sales", "Sales", "sales"]) == ["sales", "Sales_2", "sales_3"]

    def test_quote_per_dialect(self):
        assert quote_identifier("we`ird", "mysql") == "`we``ird`"
        assert quote_identifier("we]ird", "mssql") == "[we]]ird]"
        assert quote_identifier('we"ird', "postgres") == '"we""ird"'


class TestDtypeMapping:
    @pytest.mark.parametrize(
        ("dtype", "expected"),
        [
            ("bool", "BOOLEAN"),
            ("datetime64[ns]", "TIMESTAMP"),
            ("int64", "BIGINT"),
            ("float64", "DECIMAL"),
            ("object", "TEXT"),
        ],
    )
    def test_mapping(self, dtype, expected):
        assert _sql_type_for(dtype) == expected


class TestPathTraversal:
    def test_traversal_session_id_rejected(self):
        with pytest.raises(DatabaseConnectionError):
            db_connector._sqlite_db_path("../../evil")

    def test_uuid_session_id_accepted(self):
        assert db_connector._sqlite_db_path(SESSION).endswith(f"{SESSION}_data.db")


class TestFileParsing:
    def _xlsx_bytes(self, frames: dict[str, pd.DataFrame]) -> bytes:
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            for sheet, df in frames.items():
                df.to_excel(writer, sheet_name=sheet, index=False)
        return buf.getvalue()

    def test_xlsx_roundtrip_with_sanitized_names(self):
        df = pd.DataFrame({"Order ID": [1, 2], "Total Amount": [10.5, 20.0]})
        tables = parse_excel_to_sqlite(
            self._xlsx_bytes({"Q1 Sales": df}), SESSION, "report.xlsx"
        )
        assert tables[0]["table_name"] == "q1_sales"
        col_names = [c["name"] for c in tables[0]["columns"]]
        assert col_names == ["Order_ID", "Total_Amount"]

        # The sanitized names must exist in the actual DB → samples fetch works
        result = fetch_sample_rows("q1_sales", "sqlite", session_id=SESSION)
        assert result["columns"] == ["Order_ID", "Total_Amount"]
        assert len(result["rows"]) == 2

    def test_duplicate_sheet_names_do_not_overwrite(self):
        frames = {
            "sales": pd.DataFrame({"a": [1]}),
            "Sales ": pd.DataFrame({"a": [2]}),  # sanitizes to the same base name
        }
        tables = parse_excel_to_sqlite(self._xlsx_bytes(frames), SESSION, "x.xlsx")
        names = [t["table_name"] for t in tables]
        assert len(set(names)) == 2  # second sheet suffixed, not dropped

    def test_csv_supported(self):
        csv = b"name,amount\nwidget,10\ngadget,25\n"
        tables = parse_excel_to_sqlite(csv, SESSION, "My Data.csv")
        assert tables[0]["table_name"] == "my_data"
        result = fetch_sample_rows("my_data", "sqlite", session_id=SESSION)
        assert result["rows"][0] == ["widget", 10]
