# SQLGlot dialect mapping, validation, and the read-only execution guard.

import pytest

from agents.data import transpiler


class TestDialectMapping:
    def test_postgresql_maps_to_postgres(self):
        assert transpiler.to_sqlglot_dialect("postgresql") == "postgres"

    def test_mssql_maps_to_tsql(self):
        assert transpiler.to_sqlglot_dialect("mssql") == "tsql"

    def test_passthrough_dialects(self):
        for d in ("sqlite", "mysql", "postgres", "tsql"):
            assert transpiler.to_sqlglot_dialect(d) == d

    def test_unknown_falls_back_to_sqlite(self):
        assert transpiler.to_sqlglot_dialect("weird") == "sqlite"
        assert transpiler.to_sqlglot_dialect("") == "sqlite"


class TestValidation:
    def test_postgres_validation_actually_runs(self):
        # Regression: "postgresql" used to raise inside sqlglot and silently no-op
        out = transpiler.validate_and_format_sql("SELECT id, name FROM users LIMIT 5", "postgresql")
        assert "SELECT" in out and "\n" in out  # pretty-printed → validated

    def test_mssql_validation_actually_runs(self):
        out = transpiler.validate_and_format_sql("SELECT TOP 3 id FROM users", "mssql")
        assert "TOP" in out

    def test_broken_sql_falls_back_to_raw(self):
        bad = "SELEC oops FROM"
        assert transpiler.validate_and_format_sql(bad, "sqlite") == bad


class TestReadOnlyGuard:
    @pytest.mark.parametrize(
        "sql",
        [
            "SELECT * FROM t",
            "WITH x AS (SELECT 1 AS a) SELECT a FROM x",
            "SELECT 1 UNION SELECT 2",
        ],
    )
    def test_reads_allowed(self, sql):
        transpiler.assert_read_only(sql, "sqlite")  # must not raise

    def test_tsql_top_allowed(self):
        transpiler.assert_read_only("SELECT TOP 5 id FROM t", "mssql")

    @pytest.mark.parametrize(
        "sql",
        [
            "UPDATE t SET a = 1",
            "DELETE FROM t",
            "DROP TABLE t",
            "INSERT INTO t VALUES (1)",
            "SELECT 1; DROP TABLE t",
            "WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x",
            "PRAGMA writable_schema = 1",
        ],
    )
    def test_writes_blocked(self, sql):
        with pytest.raises(ValueError):
            transpiler.assert_read_only(sql, "sqlite")

    @pytest.mark.parametrize("dialect", ["postgresql", "postgres", "mysql", "mssql"])
    def test_unparseable_rejected_for_server_databases(self, dialect):
        # SQL we can't verify never reaches a live customer database.
        with pytest.raises(ValueError):
            transpiler.assert_read_only("SELECT !!!", dialect)

    def test_unparseable_select_allowed_for_sqlite(self):
        # Session SQLite is the user's own uploaded copy — a strict
        # single-statement SELECT fallback is acceptable there.
        transpiler.assert_read_only("SELECT !!!", "sqlite")  # must not raise

    def test_unparseable_multistatement_rejected_for_sqlite(self):
        with pytest.raises(ValueError):
            transpiler.assert_read_only("SELECT !!! ; DROP TABLE t", "sqlite")

    def test_trailing_semicolon_still_allowed_in_fallback(self):
        transpiler.assert_read_only("SELECT !!! ;", "sqlite")  # must not raise


class TestCleanExplanation:
    def test_fourth_wall_phrases_removed(self):
        text = "This query, as per your request, counts orders."
        assert "as per your request" not in transpiler.clean_explanation(text)
