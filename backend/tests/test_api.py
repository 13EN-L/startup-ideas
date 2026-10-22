from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app import main


client = TestClient(main.app)


def test_usage_rejects_naive_timestamps() -> None:
    response = client.get(
        "/usage",
        params={"start": "2026-10-21T12:00:00", "end": "2026-10-21T13:00:00"},
    )
    assert response.status_code == 422


def test_usage_rejects_reversed_timestamps() -> None:
    response = client.get(
        "/usage",
        params={
            "start": "2026-10-21T13:00:00Z",
            "end": "2026-10-21T12:00:00Z",
        },
    )
    assert response.status_code == 422


def test_health_reports_activitywatch(monkeypatch) -> None:
    monkeypatch.setattr(main.activitywatch, "is_reachable", lambda: True)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["reachable"] is True


def test_usage_returns_normalized_events(monkeypatch) -> None:
    monkeypatch.setattr(main.activitywatch, "ensure_running", lambda: None)
    monkeypatch.setattr(main.activitywatch, "buckets", lambda: [{"id": "web"}])
    monkeypatch.setattr(
        main.activitywatch,
        "events",
        lambda bucket_id, start, end: [
            {
                "timestamp": "2026-10-21T12:00:00+00:00",
                "duration": 60,
                "data": {"url": "https://example.com", "title": "Example"},
            }
        ],
    )
    response = client.get(
        "/usage",
        params={
            "start": "2026-10-21T12:00:00Z",
            "end": "2026-10-21T13:00:00Z",
        },
    )
    assert response.status_code == 200
    assert response.json()["events"][0]["site"] == "example.com"
