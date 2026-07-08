# Data-agent router guards that need no Redis or LLM: upload size limit
# and session-ID validation.

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from agents.data.router import router as data_router
from core.config import settings


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(data_router, prefix="/agents/data")
    return TestClient(app)


class TestParseExcelGuards:
    def test_oversized_upload_rejected(self, client, monkeypatch):
        monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
        big = b"x" * (1024 * 1024 + 1)
        res = client.post(
            "/agents/data/parse-excel",
            files={"file": ("big.csv", big, "text/csv")},
            headers={"X-Session-ID": "test-session-12345"},
        )
        assert res.status_code == 413

    def test_missing_session_rejected(self, client):
        res = client.post(
            "/agents/data/parse-excel",
            files={"file": ("a.csv", b"a,b\n1,2\n", "text/csv")},
        )
        assert res.status_code == 400

    def test_malformed_session_rejected(self, client):
        res = client.post(
            "/agents/data/parse-excel",
            files={"file": ("a.csv", b"a,b\n1,2\n", "text/csv")},
            headers={"X-Session-ID": "../../etc/passwd"},
        )
        assert res.status_code == 400
