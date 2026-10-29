"""The store keeps sessions on disk so they survive the program restarting."""
from app.store import SessionStore


def test_running_session_survives_restart(tmp_path):
    path = tmp_path / "data.json"
    SessionStore(path).set_active({"kind": "computer", "task": "chem ps4"})

    assert SessionStore(path).get_active() == {"kind": "computer", "task": "chem ps4"}


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
