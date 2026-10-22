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


class AllWatchersActivityWatch(ReadyActivityWatch):
    """What a real ActivityWatch install returns: the window, browser and AFK
    watchers all report at the same time, so their events overlap."""

    EVENTS = {
        "aw-watcher-window_laptop": [
            {"timestamp": "2026-10-21T14:00:00Z", "duration": 600,
             "data": {"app": "Google Chrome", "title": "Chem PS4 - Google Docs"}},
            {"timestamp": "2026-10-21T14:10:00Z", "duration": 300,
             "data": {"app": "Discord", "title": "#general"}},
            {"timestamp": "2026-10-21T14:15:00Z", "duration": 300,
             "data": {"app": "Google Chrome", "title": "Lecture 7 - YouTube"}},
        ],
        "aw-watcher-web-chrome": [
            {"timestamp": "2026-10-21T14:00:00Z", "duration": 600,
             "data": {"url": "https://docs.google.com/document/d/abc", "title": "Chem PS4 - Google Docs"}},
            # The browser keeps reporting its active tab while Discord has focus.
            {"timestamp": "2026-10-21T14:10:00Z", "duration": 600,
             "data": {"url": "https://www.youtube.com/watch?v=x", "title": "Lecture 7 - YouTube"}},
        ],
        "aw-watcher-afk_laptop": [
            {"timestamp": "2026-10-21T14:00:00Z", "duration": 1080, "data": {"status": "not-afk"}},
            {"timestamp": "2026-10-21T14:18:00Z", "duration": 120, "data": {"status": "afk"}},
        ],
    }

    def buckets(self):
        return [{"id": bucket_id} for bucket_id in self.EVENTS]

    def events(self, bucket_id, start, end):
        return self.EVENTS[bucket_id]


def test_activity_route_builds_one_timeline_from_all_watchers():
    app = create_app(activitywatch_manager=AllWatchersActivityWatch())
    response = TestClient(app).get(
        "/activity",
        params={"start": "2026-10-21T14:00:00Z", "end": "2026-10-21T15:00:00Z"},
    )

    assert response.status_code == 200
    assert response.json()["blocks"] == [
        {"id": "b1", "start": "2026-10-21T14:00:00Z", "seconds": 600, "kind": "web",
         "app": "Google Chrome", "site": "docs.google.com", "title": "Chem PS4 - Google Docs"},
        {"id": "b2", "start": "2026-10-21T14:10:00Z", "seconds": 300, "kind": "app",
         "app": "Discord", "site": None, "title": "#general"},
        {"id": "b3", "start": "2026-10-21T14:15:00Z", "seconds": 180, "kind": "web",
         "app": "Google Chrome", "site": "www.youtube.com", "title": "Lecture 7 - YouTube"},
        {"id": "b4", "start": "2026-10-21T14:18:00Z", "seconds": 120, "kind": "idle",
         "app": "", "site": None, "title": None},
    ]
