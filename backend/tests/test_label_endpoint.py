from fastapi.testclient import TestClient

from app.main import create_app
from tests.fakes import BrokenLabeler, FakeLabeler

SECRET = "test-secret"


def web(block_id, minutes, site, title):
    return {"id": block_id, "start": "2026-10-21T14:00:00Z", "seconds": minutes * 60,
            "kind": "web", "app": "Google Chrome", "site": site, "title": title}


def llm_label(block_id, label, confidence=0.9, reason="fits the task"):
    return {"block_id": block_id, "label": label, "confidence": confidence, "reason": reason}


def post_label(labeler, body):
    client = TestClient(create_app(labeler=labeler, shared_secret=SECRET))
    return client.post("/label", json=body, headers={"X-Flora-Secret": SECRET})


def test_fully_labeled_session_returns_labels_and_stats():
    labeler = FakeLabeler({"labels": [
        llm_label("b1", "on_task"),
        llm_label("b2", "off_task", reason="social media"),
    ]})
    res = post_label(labeler, {
        "task": "finish chem problem set 4",
        "blocks": [web("b1", 30, "docs.google.com", "Chem PS4"),
                   web("b2", 10, "instagram.com", "Instagram")],
    })

    assert res.status_code == 200
    body = res.json()
    assert [(l["block_id"], l["label"]) for l in body["labels"]] == [("b1", "on_task"), ("b2", "off_task")]
    assert body["stats"]["on_task_pct"] == 75.0
    assert body["needs_review"] == []


def test_request_without_shared_secret_is_rejected():
    client = TestClient(create_app(labeler=FakeLabeler(), shared_secret=SECRET))
    res = client.post("/label", json={"task": "x", "blocks": []},
                      headers={"X-Flora-Secret": "wrong"})
    assert res.status_code == 401


def test_idle_blocks_count_as_breaks_without_asking_the_llm():
    labeler = FakeLabeler({"labels": [llm_label("b1", "on_task")]})
    idle = {"id": "b2", "start": "2026-10-21T14:30:00Z", "seconds": 600, "kind": "idle"}
    res = post_label(labeler, {"task": "chem ps4",
                               "blocks": [web("b1", 30, "docs.google.com", "Chem PS4"), idle]})

    assert res.status_code == 200
    b2 = res.json()["labels"][1]
    assert (b2["label"], b2["source"]) == ("break", "rule")
    assert [b.id for b in labeler.calls[0]["blocks"]] == ["b1"]


def test_coverage_errors_are_sent_back_to_the_llm_for_a_retry():
    labeler = FakeLabeler(
        {"labels": [llm_label("b1", "on_task"), llm_label("b9", "on_task")]},  # misses b2, invents b9
        {"labels": [llm_label("b1", "on_task"), llm_label("b2", "off_task")]},
    )
    res = post_label(labeler, {"task": "chem ps4", "blocks": [
        web("b1", 30, "docs.google.com", "Chem PS4"),
        web("b2", 10, "instagram.com", "Instagram"),
    ]})

    assert res.status_code == 200
    assert res.json()["labels"][1]["label"] == "off_task"
    feedback = " ".join(labeler.calls[1]["feedback"])
    assert "b2" in feedback and "b9" in feedback


def test_schema_errors_are_sent_back_to_the_llm_for_a_retry():
    labeler = FakeLabeler(
        {"labels": [llm_label("b1", "maybe")]},
        {"labels": [llm_label("b1", "on_task")]},
    )
    res = post_label(labeler, {"task": "chem ps4",
                               "blocks": [web("b1", 30, "docs.google.com", "Chem PS4")]})

    assert res.status_code == 200
    assert res.json()["labels"][0]["label"] == "on_task"
    assert labeler.calls[1]["feedback"]


def test_duplicate_labels_for_one_block_trigger_a_retry():
    labeler = FakeLabeler(
        {"labels": [llm_label("b1", "on_task"), llm_label("b1", "off_task")]},
        {"labels": [llm_label("b1", "on_task")]},
    )
    res = post_label(labeler, {"task": "chem ps4",
                               "blocks": [web("b1", 30, "docs.google.com", "Chem PS4")]})

    assert res.status_code == 200
    assert "b1" in " ".join(labeler.calls[1]["feedback"])


def test_blocks_still_unlabeled_after_two_retries_go_to_review_as_unclear():
    bad = {"labels": [llm_label("b1", "on_task")]}  # never labels b2
    labeler = FakeLabeler(bad, bad, bad)
    res = post_label(labeler, {"task": "chem ps4", "blocks": [
        web("b1", 30, "docs.google.com", "Chem PS4"),
        web("b2", 10, "youtube.com", "Lecture 7"),
    ]})

    assert res.status_code == 200
    body = res.json()
    assert len(labeler.calls) == 3
    assert body["labels"][0]["label"] == "on_task"
    assert (body["labels"][1]["label"], body["labels"][1]["source"]) == ("unclear", "unlabeled")
    assert body["needs_review"] == ["b2"]
    assert body["stats"]["unclear_minutes"] == 10


def test_unreachable_llm_sends_every_block_to_review():
    res = post_label(BrokenLabeler(), {"task": "chem ps4", "blocks": [
        web("b1", 30, "docs.google.com", "Chem PS4"),
    ]})

    assert res.status_code == 502
    assert "Claude request failed" in res.json()["detail"]


def test_low_confidence_labels_go_to_review_as_unclear():
    labeler = FakeLabeler({"labels": [
        llm_label("b1", "on_task", confidence=0.95),
        llm_label("b2", "on_task", confidence=0.4, reason="could be a chem lecture"),
    ]})
    res = post_label(labeler, {"task": "chem ps4", "blocks": [
        web("b1", 30, "docs.google.com", "Chem PS4"),
        web("b2", 10, "youtube.com", "Lecture 7"),
    ]})

    b2 = res.json()["labels"][1]
    assert (b2["label"], b2["source"]) == ("unclear", "low_confidence")
    assert b2["reason"] == "could be a chem lecture"
    assert res.json()["needs_review"] == ["b2"]


def test_allowlist_and_blocklist_override_the_llm_and_skip_it():
    labeler = FakeLabeler({"labels": [llm_label("b3", "on_task")]})
    discord = {"id": "b2", "start": "2026-10-21T14:30:00Z", "seconds": 300,
               "kind": "app", "app": "Discord"}
    res = post_label(labeler, {
        "task": "chem ps4",
        "allowlist": ["instructure.com"],
        "blocklist": ["discord"],
        "blocks": [web("b1", 20, "umich.instructure.com", "Canvas - CHEM 210"), discord,
                   dict(web("b3", 10, "docs.google.com", "Chem PS4"), start="2026-10-21T14:35:00Z")],
    })

    labels = res.json()["labels"]
    assert [(l["label"], l["source"]) for l in labels] == [
        ("on_task", "override"), ("off_task", "override"), ("on_task", "llm")]
    assert [b.id for b in labeler.calls[0]["blocks"]] == ["b3"]


def test_request_with_duplicate_block_ids_is_rejected():
    block = web("b1", 10, "docs.google.com", "Chem PS4")
    res = post_label(FakeLabeler(), {"task": "chem ps4", "blocks": [block, block]})
    assert res.status_code == 422


def test_request_with_blocks_out_of_time_order_is_rejected():
    late = dict(web("b1", 10, "docs.google.com", "Chem PS4"), start="2026-10-21T15:00:00Z")
    early = web("b2", 10, "docs.google.com", "Chem PS4")
    res = post_label(FakeLabeler(), {"task": "chem ps4", "blocks": [late, early]})
    assert res.status_code == 422
