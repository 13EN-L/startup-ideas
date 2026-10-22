from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import create_app


class ReadyActivityWatch:
    base_url = "http://127.0.0.1:5600"
    startup_error = None
    started_by_manager = True

    @property
    def process_running(self):
        return True

    def startup(self):
        return True

    def close(self):
        return None

    def is_reachable(self):
        return True

    def ensure_running(self):
        return None

    def buckets(self):
        return [{"id": "aw-watcher-web-chrome"}]

    def events(self, bucket_id, start, end):
        return [{
            "timestamp": "2026-10-21T14:00:00Z",
            "duration": 30,
            "data": {"url": "https://docs.google.com", "title": "Chem PS4"},
        }]


def test_activity_route_returns_extension_contract():
    app = create_app(
        shared_secret="secret",
        activitywatch_manager=ReadyActivityWatch(),
    )
    response = TestClient(app).get(
        "/activity",
        params={
            "start": "2026-10-21T14:00:00Z",
            "end": "2026-10-21T15:00:00Z",
        },
        headers={"X-Flora-Secret": "secret"},
    )

    assert response.status_code == 200
    assert response.json()["blocks"] == [{
        "id": "b1",
        "start": "2026-10-21T14:00:00Z",
        "seconds": 30,
        "kind": "web",
        "app": "",
        "site": "docs.google.com",
        "title": "Chem PS4",
    }]


def test_activity_route_requires_shared_secret():
    app = create_app(
        shared_secret="secret",
        activitywatch_manager=ReadyActivityWatch(),
    )
    response = TestClient(app).get(
        "/activity",
        params={
            "start": "2026-10-21T14:00:00Z",
            "end": "2026-10-21T15:00:00Z",
        },
    )
    assert response.status_code == 401


def test_health_exposes_startup_diagnostic():
    manager = ReadyActivityWatch()
    manager.startup_error = "ActivityWatch exited before becoming ready"
    manager.is_reachable = lambda: False
    app = create_app(activitywatch_manager=manager)

    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json()["detail"] == "ActivityWatch exited before becoming ready"
