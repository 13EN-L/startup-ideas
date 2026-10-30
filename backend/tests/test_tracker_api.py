"""Tasks & groups: tasks come only from focus/paper sessions (named on the Focus form); the
user puts them in groups. Each task, group and the total shows tracked time (work vs AFK
idle, never double-counted) and the sessions' productivity stats, computed by code."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import create_app
from app.store import SessionStore
from tests.fakes import FakeActivityWatch, FakeClock, FakeLabeler, FakePhotoReader

MIDNIGHT = datetime(2026, 10, 21, 0, 0, tzinfo=timezone.utc)
START = datetime(2026, 10, 21, 14, 0, tzinfo=timezone.utc)


def make_client(tmp_path, clock, activitywatch=None, labeler=None, reader=None, store=None):
    return TestClient(create_app(store=store or SessionStore(tmp_path / "data.json"), now=clock,
                                 activitywatch_manager=activitywatch or FakeActivityWatch(),
                                 labeler=labeler, photo_reader=reader or FakePhotoReader()))


def summary(client, since=MIDNIGHT):
    return client.get("/api/tracker", params={"since": since.isoformat()}).json()


def task_named(body, name):
    return next(t for t in body["tasks"] if t["name"] == name)


def end_paper(client, running, confidence=0.9):
    """Ends a running paper session. Full credit at confidence >= 0.6; below that both photo
    attempts are used and the session gets half credit."""
    while True:
        client.app.state.photo_reader.outputs.append(
            {"code_word_seen": running["codeWord"], "notes_present": True, "matches_task": True,
             "confidence": confidence})
        ended = client.post(f"/api/paper-sessions/{running['id']}/end",
                            json={"imageBase64": "aGVsbG8=", "mediaType": "image/jpeg"})
        assert ended.status_code == 200, ended.text
        if ended.json().get("completed") is not False:
            return ended.json()


def paper_session(client, clock, task, minutes, confidence=0.9):
    """Runs a paper session from start to end."""
    running = client.post("/api/paper-sessions", json={"task": task}).json()
    clock.advance(minutes=minutes)
    return end_paper(client, running, confidence)


def computer_session(client, clock, task, minutes):
    """Runs a computer session from start to end."""
    running = client.post("/api/sessions", json={"task": task}).json()
    clock.advance(minutes=minutes)
    ended = client.post(f"/api/sessions/{running['id']}/end")
    assert ended.status_code == 200, ended.text
    return ended.json()


def set_groups(client, body, name, groups):
    task_id = task_named(body, name)["id"]
    assert client.patch(f"/api/tracker/tasks/{task_id}", json={"tags": groups}).status_code == 200


def browser_event(minute, minutes, url, title):
    return {"timestamp": (START + timedelta(minutes=minute)).isoformat(),
            "duration": minutes * 60, "data": {"url": url, "title": title}}


def on_task(block_id):
    return {"block_id": block_id, "label": "on_task", "confidence": 0.9, "reason": "fits the task"}


def test_tasks_cannot_be_added_or_timed_by_hand(tmp_path):
    client = make_client(tmp_path, FakeClock(START))

    assert client.post("/api/tracker/tasks", json={"name": "chem ps4"}).status_code == 404
    assert client.post("/api/tracker/tasks/x/start").status_code == 404
    assert client.post("/api/tracker/tasks/x/stop").status_code == 404
    assert summary(client)["tasks"] == []


def test_a_session_creates_its_task_which_runs_until_the_session_ends(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)

    running = client.post("/api/paper-sessions", json={"task": "Chem notes"}).json()
    clock.advance(minutes=30)
    during = task_named(summary(client), "Chem notes")
    end_paper(client, running)
    clock.advance(minutes=10)
    after = task_named(summary(client), "Chem notes")

    assert during["running"] is True
    assert during["tags"] == []
    assert after["running"] is False
    assert after["all"]["work_seconds"] == 30 * 60
    assert after["all"]["sessions"] == 1


def test_sessions_with_the_same_name_add_up_in_one_task_with_combined_llm_stats(tmp_path):
    clock = FakeClock(START)
    client = make_client(
        tmp_path, clock,
        activitywatch=FakeActivityWatch(
            browser_event(0, 20, "https://docs.google.com/document/d/1", "Chem PS4"),
            browser_event(20, 10, "https://www.instagram.com/", "Instagram"),
            browser_event(60, 15, "https://docs.google.com/document/d/1", "Chem PS4"),
            browser_event(75, 5, "https://www.instagram.com/", "Instagram"),
        ),
        labeler=FakeLabeler({"labels": [on_task("b1")]}, {"labels": [on_task("b1")]}))

    first = computer_session(client, clock, "chem ps4", 30)
    clock.advance(minutes=30)                       # 15:00
    second = computer_session(client, clock, "Chem PS4", 20)

    body = summary(client)
    assert [t["name"] for t in body["tasks"]] == ["chem ps4"]
    task = body["tasks"][0]
    assert task["session_ids"] == [first["id"], second["id"]]
    assert task["all"]["sessions"] == 2
    assert task["all"]["work_seconds"] == 50 * 60
    assert task["all"]["stats"] == {
        "total_minutes": 50, "on_task_minutes": 35, "off_task_minutes": 15, "break_minutes": 0,
        "unclear_minutes": 0, "on_task_pct": 70, "longest_streak_minutes": 20,
    }
    assert body["total"]["all"]["stats"] == task["all"]["stats"]


def test_reviewing_a_block_updates_the_tasks_stats(tmp_path):
    clock = FakeClock(START)
    unsure = {"block_id": "b1", "label": "on_task", "confidence": 0.3, "reason": "maybe"}
    client = make_client(
        tmp_path, clock,
        activitywatch=FakeActivityWatch(
            browser_event(0, 20, "https://www.youtube.com/watch?v=1", "Lecture 5")),
        labeler=FakeLabeler({"labels": [unsure]}))
    session = computer_session(client, clock, "chem lecture", 20)
    assert summary(client)["tasks"][0]["all"]["stats"]["unclear_minutes"] == 20

    client.post(f"/api/sessions/{session['id']}/blocks/b1/review", json={"label": "on_task"})

    assert summary(client)["tasks"][0]["all"]["stats"]["on_task_minutes"] == 20


def test_paper_credit_counts_as_on_task_and_the_uncredited_rest_as_unclear(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)

    paper_session(client, clock, "chem notes", 40, confidence=0.4)   # 50% credit

    stats = summary(client)["tasks"][0]["all"]["stats"]
    assert stats["total_minutes"] == 40
    assert stats["on_task_minutes"] == 20
    assert stats["unclear_minutes"] == 20
    assert stats["on_task_pct"] == 50


def test_tasks_are_assigned_to_groups_and_groups_combine_their_tasks(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)
    paper_session(client, clock, "chem reading", 30)
    clock.advance(minutes=10)
    paper_session(client, clock, "chem ps4", 20)
    clock.advance(minutes=10)
    paper_session(client, clock, "email TA", 10)

    body = summary(client)
    set_groups(client, body, "chem reading", ["Chem", "School"])
    set_groups(client, body, "chem ps4", ["chem"])
    body = summary(client)

    groups = {g["name"]: g for g in body["groups"]}
    assert list(groups) == ["Chem", "School"]
    assert groups["Chem"]["all"]["work_seconds"] == 50 * 60
    assert groups["Chem"]["all"]["sessions"] == 2
    assert groups["Chem"]["all"]["stats"]["on_task_minutes"] == 50
    assert len(groups["Chem"]["session_ids"]) == 2
    assert groups["School"]["all"]["stats"]["on_task_minutes"] == 30
    assert body["total"]["all"]["work_seconds"] == 60 * 60
    assert body["total"]["all"]["sessions"] == 3


def afk_event(minute, minutes, status):
    return {"timestamp": (START + timedelta(minutes=minute)).isoformat(),
            "duration": minutes * 60, "data": {"status": status}}


def test_away_from_keyboard_time_is_idle_not_work(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock, FakeActivityWatch(afk=[
        afk_event(0, 20, "not-afk"), afk_event(20, 15, "afk"), afk_event(35, 25, "not-afk"),
    ]))
    paper_session(client, clock, "chem reading", 60)
    set_groups(client, summary(client), "chem reading", ["Chem"])

    body = summary(client)

    assert task_named(body, "chem reading")["all"]["work_seconds"] == 45 * 60
    assert task_named(body, "chem reading")["all"]["idle_seconds"] == 15 * 60
    assert body["groups"][0]["all"]["idle_seconds"] == 15 * 60
    assert body["total"]["today"]["idle_seconds"] == 15 * 60
    assert body["activitywatch"] is True


def test_today_only_counts_time_and_sessions_since_local_midnight(tmp_path):
    clock = FakeClock(MIDNIGHT - timedelta(minutes=30))
    client = make_client(tmp_path, clock)
    paper_session(client, clock, "late-night essay", 20)          # 23:30 - 23:50
    clock.advance(minutes=10)
    paper_session(client, clock, "late-night essay", 20)          # 00:00 - 00:20

    task = task_named(summary(client, since=MIDNIGHT), "late-night essay")

    assert task["today"]["work_seconds"] == 20 * 60
    assert task["today"]["sessions"] == 1
    assert task["today"]["stats"]["on_task_minutes"] == 20
    assert task["all"]["work_seconds"] == 40 * 60
    assert task["all"]["stats"]["on_task_minutes"] == 40


def test_tasks_can_be_renamed_regrouped_and_deleted(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)
    paper_session(client, clock, "chem", 10)
    task_id = summary(client)["tasks"][0]["id"]

    edited = client.patch(f"/api/tracker/tasks/{task_id}",
                          json={"name": "chem ps4", "tags": ["Chem", "Due Friday"]})

    assert edited.status_code == 200
    body = summary(client)
    assert body["tasks"][0]["name"] == "chem ps4"
    assert [g["name"] for g in body["groups"]] == ["Chem", "Due Friday"]

    assert client.delete(f"/api/tracker/tasks/{task_id}").status_code == 200
    assert summary(client)["tasks"] == []


def test_tasks_running_at_the_same_time_each_have_their_own_timer(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)
    reading = client.post("/api/paper-sessions", json={"task": "chem reading"}).json()
    clock.advance(minutes=10)                       # 14:10
    problems = client.post("/api/paper-sessions", json={"task": "chem ps4"}).json()
    clock.advance(minutes=20)                       # 14:30
    end_paper(client, reading)
    clock.advance(minutes=10)                       # 14:40

    body = summary(client)
    assert task_named(body, "chem reading")["running"] is False
    assert task_named(body, "chem reading")["all"]["work_seconds"] == 30 * 60
    assert task_named(body, "chem ps4")["running"] is True
    assert task_named(body, "chem ps4")["all"]["work_seconds"] == 30 * 60
    assert body["total"]["all"]["work_seconds"] == 40 * 60   # 14:00-14:40, counted once

    end_paper(client, problems)
    set_groups(client, summary(client), "chem reading", ["Chem"])
    set_groups(client, summary(client), "chem ps4", ["Chem"])
    chem = summary(client)["groups"][0]["all"]
    assert chem["sessions"] == 2
    assert chem["stats"]["total_minutes"] == 40              # overlapping minutes count once
    assert chem["stats"]["on_task_minutes"] == 40


def test_without_activitywatch_all_tracked_time_is_work_and_the_page_is_told(tmp_path):
    class UnreachableActivityWatch(FakeActivityWatch):
        def ensure_running(self):
            from app.activitywatch import ActivityWatchError
            raise ActivityWatchError("ActivityWatch is not reachable")

    clock = FakeClock(START)
    client = make_client(tmp_path, clock, UnreachableActivityWatch())
    client.post("/api/paper-sessions", json={"task": "chem ps4"})
    clock.advance(minutes=10)

    body = summary(client)

    assert body["activitywatch"] is False
    assert body["total"]["all"]["work_seconds"] == 600
    assert body["total"]["all"]["idle_seconds"] == 0


def test_a_session_still_ends_if_its_task_was_deleted(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, clock)
    running = client.post("/api/paper-sessions", json={"task": "chem notes"}).json()
    client.delete(f"/api/tracker/tasks/{running['trackerTaskId']}")
    clock.advance(minutes=10)

    end_paper(client, running)

    assert client.get("/api/active").json() == []
    assert summary(client)["total"]["all"]["sessions"] == 0


def test_sessions_saved_before_they_recorded_their_task_are_matched_by_start_time(tmp_path):
    clock = FakeClock(START)
    store = SessionStore(tmp_path / "data.json")
    client = make_client(tmp_path, clock, store=store)
    session = paper_session(client, clock, "chem notes", 30)
    store.update_session({k: v for k, v in session.items() if k != "taskId"})

    task = summary(client)["tasks"][0]

    assert task["session_ids"] == [session["id"]]
    assert task["all"]["stats"]["on_task_minutes"] == 30
