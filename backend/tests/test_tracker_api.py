"""The time tracker tab: task timers that run alongside (not instead of) focus sessions.
Totals never double-count overlapping tasks, and AFK time is idle, not work."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import create_app
from app.store import SessionStore
from tests.fakes import FakeActivityWatch, FakeClock

MIDNIGHT = datetime(2026, 10, 21, 0, 0, tzinfo=timezone.utc)
START = datetime(2026, 10, 21, 14, 0, tzinfo=timezone.utc)


def make_client(tmp_path, clock, activitywatch=None):
    return TestClient(create_app(store=SessionStore(tmp_path / "data.json"), now=clock,
                                 activitywatch_manager=activitywatch or FakeActivityWatch()))


def summary(client, since=MIDNIGHT):
    return client.get("/api/tracker", params={"since": since.isoformat()}).json()


def task_named(body, name):
    return next(t for t in body["tasks"] if t["name"] == name)


def test_a_running_task_accumulates_work_time(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)

    created = client.post("/api/tracker/tasks", json={"name": "chem ps4", "tags": ["Chem"]})
    clock.advance(minutes=30)

    assert created.status_code == 200
    task = task_named(summary(client), "chem ps4")
    assert task["running"] is True
    assert task["tags"] == ["Chem"]
    assert task["today"] == {"work_seconds": 1800, "idle_seconds": 0}
    assert task["all"] == {"work_seconds": 1800, "idle_seconds": 0}


def test_adding_a_task_keeps_the_current_one_running_and_stop_freezes_its_time(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)
    first = client.post("/api/tracker/tasks", json={"name": "chem ps4"}).json()
    clock.advance(minutes=10)
    client.post("/api/tracker/tasks", json={"name": "essay outline"})
    clock.advance(minutes=10)

    stopped = client.post(f"/api/tracker/tasks/{first['id']}/stop")
    clock.advance(minutes=10)

    assert stopped.status_code == 200
    body = summary(client)
    assert task_named(body, "chem ps4")["running"] is False
    assert task_named(body, "chem ps4")["all"]["work_seconds"] == 20 * 60
    assert task_named(body, "essay outline")["running"] is True
    assert task_named(body, "essay outline")["all"]["work_seconds"] == 20 * 60


def test_a_stopped_task_can_be_restarted_and_adds_to_its_time(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)
    task = client.post("/api/tracker/tasks", json={"name": "chem ps4"}).json()
    clock.advance(minutes=10)
    client.post(f"/api/tracker/tasks/{task['id']}/stop")
    clock.advance(minutes=30)

    client.post(f"/api/tracker/tasks/{task['id']}/start")
    clock.advance(minutes=5)

    assert task_named(summary(client), "chem ps4")["all"]["work_seconds"] == 15 * 60


def test_group_and_overall_totals_count_overlapping_tasks_once(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)
    reading = client.post("/api/tracker/tasks",
                          json={"name": "chem reading", "tags": ["Chem", "School"]}).json()
    clock.advance(minutes=15)                      # 14:15
    problems = client.post("/api/tracker/tasks", json={"name": "chem ps4", "tags": ["chem"]}).json()
    clock.advance(minutes=15)                      # 14:30
    client.post(f"/api/tracker/tasks/{reading['id']}/stop")
    clock.advance(minutes=15)                      # 14:45
    client.post(f"/api/tracker/tasks/{problems['id']}/stop")
    clock.advance(minutes=15)                      # 15:00
    errands = client.post("/api/tracker/tasks", json={"name": "email TA"}).json()
    clock.advance(minutes=10)                      # 15:10
    client.post(f"/api/tracker/tasks/{errands['id']}/stop")

    body = summary(client)

    groups = {g["name"]: g["all"]["work_seconds"] for g in body["groups"]}
    assert groups == {"Chem": 45 * 60, "School": 30 * 60}
    assert body["total"]["all"]["work_seconds"] == 55 * 60


def afk_event(minute, minutes, status):
    return {"timestamp": (START + timedelta(minutes=minute)).isoformat(),
            "duration": minutes * 60, "data": {"status": status}}


def test_away_from_keyboard_time_is_idle_not_work_and_counted_once_per_group(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock, FakeActivityWatch(afk=[
        afk_event(0, 20, "not-afk"), afk_event(20, 15, "afk"), afk_event(35, 25, "not-afk"),
    ]))
    reading = client.post("/api/tracker/tasks", json={"name": "chem reading", "tags": ["Chem"]}).json()
    clock.advance(minutes=10)
    problems = client.post("/api/tracker/tasks", json={"name": "chem ps4", "tags": ["Chem"]}).json()
    clock.advance(minutes=40)                      # 14:50
    client.post(f"/api/tracker/tasks/{problems['id']}/stop")
    clock.advance(minutes=10)                      # 15:00
    client.post(f"/api/tracker/tasks/{reading['id']}/stop")

    body = summary(client)

    assert task_named(body, "chem reading")["all"] == {"work_seconds": 45 * 60, "idle_seconds": 15 * 60}
    assert task_named(body, "chem ps4")["all"] == {"work_seconds": 25 * 60, "idle_seconds": 15 * 60}
    assert body["groups"][0]["all"] == {"work_seconds": 45 * 60, "idle_seconds": 15 * 60}
    assert body["total"]["today"] == {"work_seconds": 45 * 60, "idle_seconds": 15 * 60}
    assert body["activitywatch"] is True


def test_today_only_counts_time_since_local_midnight(tmp_path):
    clock = FakeClock(MIDNIGHT - timedelta(minutes=30))
    client = make_client(tmp_path, clock)
    client.post("/api/tracker/tasks", json={"name": "late-night essay"})
    clock.advance(minutes=50)                       # 00:20

    task = task_named(summary(client, since=MIDNIGHT), "late-night essay")

    assert task["today"]["work_seconds"] == 20 * 60
    assert task["all"]["work_seconds"] == 50 * 60


def test_tasks_can_be_renamed_retagged_marked_done_and_deleted(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)
    task = client.post("/api/tracker/tasks", json={"name": "chem", "tags": ["Chem"]}).json()
    clock.advance(minutes=10)

    edited = client.patch(f"/api/tracker/tasks/{task['id']}",
                          json={"name": "chem ps4", "tags": ["Chem", "Due Friday"], "done": True})

    assert edited.status_code == 200
    body = summary(client)
    assert body["tasks"][0]["name"] == "chem ps4"
    assert body["tasks"][0]["done"] is True
    assert body["tasks"][0]["running"] is False      # marking done stops the timer
    assert [g["name"] for g in body["groups"]] == ["Chem", "Due Friday"]

    assert client.delete(f"/api/tracker/tasks/{task['id']}").status_code == 200
    assert summary(client)["tasks"] == []


def test_without_activitywatch_all_tracked_time_is_work_and_the_page_is_told(tmp_path):
    class UnreachableActivityWatch(FakeActivityWatch):
        def ensure_running(self):
            from app.activitywatch import ActivityWatchError
            raise ActivityWatchError("ActivityWatch is not reachable")

    clock = FakeClock(START)
    client = make_client(tmp_path, clock, UnreachableActivityWatch())
    client.post("/api/tracker/tasks", json={"name": "chem ps4"})
    clock.advance(minutes=10)

    body = summary(client)

    assert body["activitywatch"] is False
    assert body["total"]["all"] == {"work_seconds": 600, "idle_seconds": 0}


def end_paper_session(client, reader):
    code_word = client.get("/api/active").json()["codeWord"]
    reader.outputs.append({"code_word_seen": code_word, "notes_present": True,
                           "matches_task": True, "confidence": 0.9})
    return client.post("/api/paper-sessions/end",
                       json={"imageBase64": "aGVsbG8=", "mediaType": "image/jpeg"})


def test_a_focus_session_runs_as_a_tracker_task_alongside_the_others(tmp_path):
    from tests.fakes import FakePhotoReader
    clock = FakeClock(START)
    reader = FakePhotoReader()
    client = TestClient(create_app(store=SessionStore(tmp_path / "data.json"), now=clock,
                                   activitywatch_manager=FakeActivityWatch(), photo_reader=reader))
    client.post("/api/tracker/tasks", json={"name": "essay outline"})
    clock.advance(minutes=5)

    client.post("/api/paper-sessions", json={"task": "Chem notes"})
    clock.advance(minutes=30)
    during = summary(client)
    end_paper_session(client, reader)
    clock.advance(minutes=10)
    after = summary(client)

    assert task_named(during, "Chem notes")["running"] is True
    assert task_named(during, "essay outline")["running"] is True
    assert task_named(after, "Chem notes")["running"] is False
    assert task_named(after, "Chem notes")["all"]["work_seconds"] == 30 * 60
    assert task_named(after, "essay outline")["running"] is True


def test_a_focus_session_resumes_an_unfinished_task_with_the_same_name(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)
    task = client.post("/api/tracker/tasks", json={"name": "chem notes", "tags": ["Chem"]}).json()
    client.post(f"/api/tracker/tasks/{task['id']}/stop")

    client.post("/api/sessions", json={"task": "Chem Notes"})
    clock.advance(minutes=10)

    body = summary(client)
    assert [t["name"] for t in body["tasks"]] == ["chem notes"]
    assert body["tasks"][0]["running"] is True
    assert body["groups"][0]["name"] == "Chem"


def test_ending_a_session_leaves_a_task_running_that_was_already_running(tmp_path):
    from tests.fakes import FakePhotoReader
    clock = FakeClock(START)
    reader = FakePhotoReader()
    client = TestClient(create_app(store=SessionStore(tmp_path / "data.json"), now=clock,
                                   activitywatch_manager=FakeActivityWatch(), photo_reader=reader))
    client.post("/api/tracker/tasks", json={"name": "chem notes"})
    client.post("/api/paper-sessions", json={"task": "chem notes"})
    clock.advance(minutes=10)

    end_paper_session(client, reader)

    assert task_named(summary(client), "chem notes")["running"] is True


def test_a_session_still_ends_if_its_tracker_task_was_deleted(tmp_path):
    from tests.fakes import FakePhotoReader
    clock = FakeClock(START)
    reader = FakePhotoReader()
    client = TestClient(create_app(store=SessionStore(tmp_path / "data.json"), now=clock,
                                   activitywatch_manager=FakeActivityWatch(), photo_reader=reader))
    client.post("/api/paper-sessions", json={"task": "chem notes"})
    task_id = client.get("/api/active").json()["trackerTaskId"]
    client.delete(f"/api/tracker/tasks/{task_id}")
    clock.advance(minutes=10)

    ended = end_paper_session(client, reader)

    assert ended.status_code == 200
    assert client.get("/api/active").json() is None
