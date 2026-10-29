"""Session history, the running session and user settings, kept in one local JSON file.

Replaces the Chrome extension's chrome.storage: there are no accounts or cloud sync.
"""
from __future__ import annotations

import json
from pathlib import Path
import threading
from typing import Any, Optional


class SessionStore:
    """With no path, data lives only in memory (used by tests that don't care about disk)."""

    def __init__(self, path: Optional[Path] = None):
        self.path = path
        self._lock = threading.Lock()
        self._data: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        if self.path is None or not self.path.is_file():
            return {}
        return json.loads(self.path.read_text(encoding="utf-8"))

    def _save(self) -> None:
        if self.path is None:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self._data, indent=2), encoding="utf-8")
        temporary.replace(self.path)  # a crash mid-write can't leave a half-written file

    def get_active(self) -> Optional[dict]:
        return self._data.get("active")

    def set_active(self, active: Optional[dict]) -> None:
        with self._lock:
            if active:
                self._data["active"] = active
            else:
                self._data.pop("active", None)
            self._save()

    def get_settings(self) -> dict:
        return dict(self._data.get("settings", {}))

    def set_settings(self, values: dict) -> None:
        with self._lock:
            self._data["settings"] = values
            self._save()

    def tasks(self) -> list[dict]:
        """The time tracker's tasks (see tracker.py)."""
        return list(self._data.get("tasks", []))

    def save_tasks(self, tasks: list[dict]) -> None:
        with self._lock:
            self._data["tasks"] = tasks
            self._save()

    def history(self) -> list[dict]:
        return list(self._data.get("history", []))

    def save_session(self, session: dict) -> None:
        with self._lock:
            self._data.setdefault("history", []).append(session)
            self._save()

    def update_session(self, session: dict) -> None:
        """Replaces the saved session with the same id."""
        with self._lock:
            self._data["history"] = [
                session if saved["id"] == session["id"] else saved
                for saved in self._data.get("history", [])
            ]
            self._save()
