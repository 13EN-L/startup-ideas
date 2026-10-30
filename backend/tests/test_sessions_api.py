"""The session API the local FocusGarden page uses (it replaces the Chrome extension's
service worker). Claude and ActivityWatch are faked; the store lives in a temp folder."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import create_app
from app.store import SessionStore
from tests.fakes import BrokenLabeler, FakeActivityWatch, FakeClock, FakeLabeler, FakePhotoReader

START = datetime(2026, 10, 21, 14, 0, tzinfo=timezone.utc)


def browser_event(minute, minutes, url, title):
    return {"timestamp": (START + timedelta(minutes=minute)).isoformat(),
            "duration": minutes * 60, "data": {"url": url, "title": title}}


def llm_label(block_id, label, confidence=0.9, reason="fits the task"):
    return {"block_id": block_id, "label": label, "confidence": confidence, "reason": reason}


def make_client(tmp_path, **kwargs):
    kwargs.setdefault("store", SessionStore(tmp_path / "data.json"))
    return TestClient(create_app(**kwargs))


def test_started_computer_session_is_active_with_default_distracting_sites(tmp_path):
    client = make_client(tmp_path)

    started = client.post("/api/sessions", json={
        "task": "finish chem ps4",
        "allowlist": ["Instagram.com"],
        "blocklist": ["Discord"],
    })

    assert started.status_code == 200
    [active] = client.get("/api/active").json()
    assert active["kind"] == "computer"
    assert active["task"] == "finish chem ps4"
    assert active["allowlist"] == ["Instagram.com"]
    assert active["blocklist"] == [
        "discord", "facebook.com", "snapchat.com", "tiktok.com", "twitter.com", "x.com",
    ]


def test_ending_a_computer_session_labels_its_activity_and_saves_it(tmp_path):
    clock = FakeClock(START)
    labeler = FakeLabeler({"labels": [llm_label("b1", "on_task")]})
    client = make_client(tmp_path, now=clock, labeler=labeler, activitywatch_manager=FakeActivityWatch(
        browser_event(0, 30, "https://docs.google.com/document/d/1", "Chem PS4"),
        browser_event(30, 10, "https://www.instagram.com/", "Instagram"),
    ))
    client.post("/api/sessions", json={"task": "finish chem ps4"})
    clock.advance(minutes=60)

    ended = end_computer(client)

    assert ended.status_code == 200
    session = ended.json()
    assert session["task"] == "finish chem ps4"
    assert session["end"] == "2026-10-21T15:00:00+00:00"
    assert [(l["block_id"], l["label"], l["source"]) for l in session["result"]["labels"]] == [
        ("b1", "on_task", "llm"), ("b2", "off_task", "override"),
    ]
    assert session["result"]["stats"]["on_task_minutes"] == 30
    assert [b["site"] for b in session["blocks"]] == ["docs.google.com", "www.instagram.com"]
    assert client.get("/api/active").json() == []
    assert client.get("/api/history").json() == [session]


def test_plant_is_picked_at_start_and_grows_from_verified_on_task_minutes(tmp_path):
    web_root = tmp_path / "web"
    (web_root / "plants").mkdir(parents=True)
    (web_root / "plants" / "plants.json").write_text(
        '{"minutesToFullGrowth": 60, "plants": [{"name": "Fern", "file": "fern.gif",'
        ' "minutesToFullGrowth": 40}]}', encoding="utf-8")
    clock = FakeClock(START)
    client = make_client(
        tmp_path, now=clock, web_root=web_root,
        labeler=FakeLabeler({"labels": [llm_label("b1", "on_task")]}),
        activitywatch_manager=FakeActivityWatch(
            browser_event(0, 30, "https://docs.google.com/document/d/1", "Chem PS4")),
    )
    client.post("/api/sessions", json={"task": "finish chem ps4"})
    assert client.get("/api/active").json()[0]["plant"] == {
        "name": "Fern", "gif": "plants/fern.gif", "minutesToFullGrowth": 40}
    clock.advance(minutes=30)

    plant = end_computer(client).json()["plant"]

    assert plant == {"name": "Fern", "gif": "plants/fern.gif", "minutesToFullGrowth": 40,
                     "minutes": 30, "progress": 0.75, "percent": 75, "minutesLeft": 10}


def ended_session_needing_review(tmp_path):
    clock = FakeClock(START)
    client = make_client(
        tmp_path, now=clock,
        labeler=FakeLabeler({"labels": [llm_label("b1", "on_task", confidence=0.3)]}),
        activitywatch_manager=FakeActivityWatch(
            browser_event(0, 30, "https://www.youtube.com/watch?v=1", "Le Chatelier explained")),
    )
    client.post("/api/sessions", json={"task": "finish chem ps4"})
    clock.advance(minutes=30)
    return client, end_computer(client).json()


def test_reviewing_an_unclear_block_recomputes_stats_and_plant(tmp_path):
    client, session = ended_session_needing_review(tmp_path)
    assert session["result"]["needs_review"] == ["b1"]
    assert session["plant"]["minutes"] == 0

    reviewed = client.post(f"/api/sessions/{session['id']}/blocks/b1/review",
                           json={"label": "on_task"})

    assert reviewed.status_code == 200
    body = reviewed.json()
    assert body["result"]["labels"][0]["label"] == "on_task"
    assert body["result"]["labels"][0]["source"] == "user"
    assert body["result"]["needs_review"] == []
    assert body["result"]["stats"]["on_task_minutes"] == 30
    assert body["plant"]["minutes"] == 30
    assert client.get("/api/history").json() == [body]


def test_review_only_accepts_on_task_off_task_or_break(tmp_path):
    client, session = ended_session_needing_review(tmp_path)

    reviewed = client.post(f"/api/sessions/{session['id']}/blocks/b1/review",
                           json={"label": "unclear"})

    assert reviewed.status_code == 422


def photo_verdict(code_word, notes=True, matches=True, confidence=0.9):
    return {"code_word_seen": code_word, "notes_present": notes, "matches_task": matches,
            "confidence": confidence}


PHOTO = {"imageBase64": "aGVsbG8=", "mediaType": "image/jpeg"}


def end_computer(client, index=0):
    """Ends a running computer session (the oldest one by default)."""
    session_id = client.get("/api/active").json()[index]["id"]
    return client.post(f"/api/sessions/{session_id}/end")


def end_paper(client, index=0):
    session_id = client.get("/api/active").json()[index]["id"]
    return client.post(f"/api/paper-sessions/{session_id}/end", json=PHOTO)


def test_paper_session_with_a_verified_photo_gets_full_credit(tmp_path):
    clock = FakeClock(START)
    reader = FakePhotoReader()
    client = make_client(tmp_path, now=clock, photo_reader=reader)
    code_word = client.post("/api/paper-sessions", json={"task": "chem notes"}).json()["codeWord"]
    assert client.get("/api/active").json()[0]["codeWord"] == code_word
    reader.outputs.append(photo_verdict(code_word))
    clock.advance(minutes=45)

    session = end_paper(client).json()

    assert session["kind"] == "paper"
    assert session["result"]["verified"] is True
    assert session["result"]["credited_minutes"] == 45
    assert session["plant"]["minutes"] == 45
    assert client.get("/api/active").json() == []


def test_failed_photo_keeps_paper_session_running_for_one_retry(tmp_path):
    clock = FakeClock(START)
    reader = FakePhotoReader(photo_verdict("wrong"), photo_verdict("wrong"))
    client = make_client(tmp_path, now=clock, photo_reader=reader)
    client.post("/api/paper-sessions", json={"task": "chem notes"})
    clock.advance(minutes=45)

    first = end_paper(client).json()
    assert first["completed"] is False
    assert first["attemptsRemaining"] == 1
    assert client.get("/api/active").json()[0]["photoAttempts"] == 1

    second = end_paper(client).json()
    assert second["result"]["verified"] is False
    assert second["result"]["credited_minutes"] == 0
    assert client.get("/api/active").json() == []


def test_photo_check_without_an_api_key_counts_as_a_failed_attempt(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, now=clock)
    client.post("/api/paper-sessions", json={"task": "chem notes"})
    clock.advance(minutes=45)

    reply = end_paper(client)

    assert reply.status_code == 200
    assert reply.json()["completed"] is False
    assert reply.json()["result"]["reason"].startswith("photo check unavailable")


def test_llm_failure_keeps_the_computer_session_running_so_it_can_be_retried(tmp_path):
    clock = FakeClock(START)
    client = make_client(tmp_path, now=clock, labeler=BrokenLabeler(),
                         activitywatch_manager=FakeActivityWatch(
                             browser_event(0, 30, "https://docs.google.com/d/1", "Chem PS4")))
    client.post("/api/sessions", json={"task": "finish chem ps4"})
    clock.advance(minutes=30)

    ended = end_computer(client)

    assert ended.status_code == 502
    assert client.get("/api/active").json()[0]["task"] == "finish chem ps4"


def test_several_tasks_can_run_at_once_and_each_ends_on_its_own(tmp_path):
    clock = FakeClock(START)
    reader = FakePhotoReader()
    client = make_client(
        tmp_path, now=clock, photo_reader=reader,
        labeler=FakeLabeler({"labels": [llm_label("b1", "on_task")]}),
        activitywatch_manager=FakeActivityWatch(
            browser_event(0, 30, "https://docs.google.com/document/d/1", "Chem PS4")))
    computer = client.post("/api/sessions", json={"task": "finish chem ps4"}).json()
    clock.advance(minutes=10)
    paper = client.post("/api/paper-sessions", json={"task": "chem notes"}).json()
    clock.advance(minutes=20)

    assert [s["id"] for s in client.get("/api/active").json()] == [computer["id"], paper["id"]]
    ended = client.post(f"/api/sessions/{computer['id']}/end")

    assert ended.status_code == 200
    assert ended.json()["id"] == computer["id"]
    assert ended.json()["result"]["stats"]["on_task_minutes"] == 30
    assert [s["id"] for s in client.get("/api/active").json()] == [paper["id"]]
    reader.outputs.append(photo_verdict(paper["codeWord"]))
    clock.advance(minutes=5)
    assert end_paper(client).json()["result"]["credited_minutes"] == 25
    assert client.get("/api/active").json() == []
    assert [s["task"] for s in client.get("/api/history").json()] == ["finish chem ps4", "chem notes"]


def test_the_same_task_cannot_run_twice_at_once(tmp_path):
    client = make_client(tmp_path)
    client.post("/api/sessions", json={"task": "finish chem ps4"})

    again = client.post("/api/paper-sessions", json={"task": "Finish Chem PS4"})

    assert again.status_code == 409
    assert again.json()["detail"] == '"Finish Chem PS4" is already running'
    assert len(client.get("/api/active").json()) == 1


def test_ending_a_session_that_is_not_running_is_404(tmp_path):
    client = make_client(tmp_path)
    paper = client.post("/api/paper-sessions", json={"task": "chem notes"}).json()

    assert client.post("/api/sessions/nope/end").status_code == 404
    assert client.post(f"/api/sessions/{paper['id']}/end").status_code == 404  # it's a paper one


def test_distracting_sites_setting_is_saved_and_used_for_new_sessions(tmp_path):
    client = make_client(tmp_path)
    assert client.get("/api/settings").json()["distractingSites"][0] == "instagram.com"

    client.put("/api/settings", json={"distractingSites": ["Reddit.com", " "]})
    client.post("/api/sessions", json={"task": "finish chem ps4"})

    assert client.get("/api/settings").json() == {"distractingSites": ["reddit.com"]}
    assert client.get("/api/active").json()[0]["blocklist"] == ["reddit.com"]


def test_other_websites_cannot_drive_the_session_api(tmp_path):
    client = make_client(tmp_path)

    cross_site = client.post("/api/sessions", json={"task": "x"},
                             headers={"Origin": "https://evil.example"})
    same_site = client.post("/api/sessions", json={"task": "x"},
                            headers={"Origin": "http://testserver"})

    assert cross_site.status_code == 403
    assert same_site.status_code == 200


def test_session_blocks_show_away_time_as_idle_and_skip_active_afk_markers(tmp_path):
    clock = FakeClock(START)
    labeler = FakeLabeler({"labels": [llm_label("b1", "on_task")]})
    client = make_client(tmp_path, now=clock, labeler=labeler, activitywatch_manager=FakeActivityWatch(
        browser_event(0, 20, "https://docs.google.com/document/d/1", "Chem PS4"),
        afk=[{"timestamp": START.isoformat(), "duration": 20 * 60, "data": {"status": "not-afk"}},
             {"timestamp": (START + timedelta(minutes=20)).isoformat(), "duration": 10 * 60,
              "data": {"status": "afk"}}],
    ))
    client.post("/api/sessions", json={"task": "finish chem ps4"})
    clock.advance(minutes=30)

    session = end_computer(client).json()

    assert [(b["kind"], b["seconds"]) for b in session["blocks"]] == [("web", 1200), ("idle", 600)]
