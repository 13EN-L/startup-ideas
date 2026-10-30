"""The store keeps sessions on disk so they survive the program restarting."""
import json

from app.store import SessionStore


def test_running_sessions_survive_restart_and_are_ended_by_id(tmp_path):
    path = tmp_path / "data.json"
    SessionStore(path).add_running({"id": "a", "kind": "computer", "task": "chem ps4"})
    SessionStore(path).add_running({"id": "b", "kind": "paper", "task": "chem notes"})
    SessionStore(path).update_running({"id": "b", "kind": "paper", "task": "chem notes",
                                       "photoAttempts": 1})
    SessionStore(path).remove_running("a")

    assert SessionStore(path).running() == [
        {"id": "b", "kind": "paper", "task": "chem notes", "photoAttempts": 1}]


def test_a_file_saved_with_one_running_session_still_loads_it(tmp_path):
    path = tmp_path / "data.json"
    path.write_text(json.dumps({"active": {"kind": "computer", "task": "chem ps4"}}), encoding="utf-8")

    [running] = SessionStore(path).running()

    assert running["task"] == "chem ps4"
    assert running["id"]


def test_history_keeps_saved_order_and_updates_replace_by_id(tmp_path):
    path = tmp_path / "data.json"
    store = SessionStore(path)
    store.save_session({"id": "a", "task": "first"})
    store.save_session({"id": "b", "task": "second"})
    store.update_session({"id": "a", "task": "first, reviewed"})

    assert SessionStore(path).history() == [
        {"id": "a", "task": "first, reviewed"},
        {"id": "b", "task": "second"},
    ]
