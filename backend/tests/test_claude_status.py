"""GET /claude-status checks the saved key and model with one tiny request."""
from fastapi.testclient import TestClient

from app.main import create_app


class ReachableClaude:
    model = "claude-test"

    def test_connection(self):
        return None


class RejectingClaude(ReachableClaude):
    def test_connection(self):
        raise RuntimeError("invalid x-api-key")


def test_status_reports_the_model_when_claude_answers():
    response = TestClient(create_app(labeler=ReachableClaude())).get("/claude-status")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "model": "claude-test"}


def test_status_is_503_without_a_key_and_502_when_claude_rejects_it():
    assert TestClient(create_app()).get("/claude-status").status_code == 503

    rejected = TestClient(create_app(labeler=RejectingClaude())).get("/claude-status")
    assert rejected.status_code == 502
    assert "invalid x-api-key" in rejected.json()["detail"]
