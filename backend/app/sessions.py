"""Computer and paper sessions: start, end, review. Formerly the Chrome extension's service
worker. Code decides stats and plant growth from validated labels, never the LLM."""
from __future__ import annotations

from datetime import datetime
import secrets
from typing import Callable, Iterable, Literal
import uuid

from pydantic import BaseModel, Field

from . import tracker
from .contracts import FinalLabel, PhotoCheckRequest, PhotoCheckResponse
from .errors import SessionError
from .plants import plant_for
from .stats import compute_stats
from .store import SessionStore

# Always off-task unless allowlisted. Matching is by site, so YouTube and Reddit are left to
# the AI (they're often study tools). Users can edit the list in Settings.
DEFAULT_DISTRACTING_SITES = [
    "instagram.com", "tiktok.com", "facebook.com", "x.com", "twitter.com", "snapchat.com",
]


CODE_WORDS = ["maple", "otter", "comet", "pebble", "lantern", "cedar", "harbor", "violet",
              "summit", "willow", "ember", "canyon", "meadow", "falcon", "glacier", "orchid"]
MAX_PAPER_PHOTO_ATTEMPTS = 2


class StartPaperSession(BaseModel):
    task: str = Field(min_length=1, max_length=200)


class EndPaperSession(BaseModel):
    imageBase64: str = Field(min_length=1)
    mediaType: Literal["image/jpeg", "image/png", "image/webp"]


class StartSession(BaseModel):
    task: str = Field(min_length=1, max_length=200)
    allowlist: list[str] = []
    blocklist: list[str] = []


def effective_blocklist(
    distracting: Iterable[str], blocklist: Iterable[str], allowlist: Iterable[str]
) -> list[str]:
    """Distracting sites plus the session's blocklist, minus its allowlist. Lowercased, sorted."""
    def clean(items: Iterable[str]) -> list[str]:
        return [s.strip().lower() for s in items if s.strip()]

    allowed = set(clean(allowlist))
    return sorted(set(clean([*distracting, *blocklist])) - allowed)


class Settings(BaseModel):
    distractingSites: list[str]


def distracting_sites(store: SessionStore) -> list[str]:
    return store.get_settings().get("distractingSites", DEFAULT_DISTRACTING_SITES)


def save_settings(store: SessionStore, values: Settings) -> dict:
    cleaned = [s.strip().lower() for s in values.distractingSites if s.strip()]
    store.set_settings({"distractingSites": cleaned})
    return store.get_settings()


def start_session(
    store: SessionStore, now: datetime, task: str, allowlist: list[str], blocklist: list[str],
    plant: dict | None,
) -> dict:
    if store.get_active():
        raise SessionError(409, "a session is already running")
    active = {
        "kind": "computer",
        "task": task,
        "start": now.isoformat(),
        "allowlist": allowlist,
        "blocklist": effective_blocklist(distracting_sites(store), blocklist, allowlist),
        "plant": plant,
        "trackerTaskId": tracker.track_session(store, now, task),
    }
    store.set_active(active)
    return active


def start_paper_session(store: SessionStore, now: datetime, task: str, plant: dict | None) -> dict:
    if store.get_active():
        raise SessionError(409, "a session is already running")
    active = {"kind": "paper", "task": task, "start": now.isoformat(),
              "codeWord": secrets.choice(CODE_WORDS), "photoAttempts": 0, "plant": plant,
              "trackerTaskId": tracker.track_session(store, now, task)}
    store.set_active(active)
    return active


def end_paper_session(
    store: SessionStore, end: datetime, check: Callable[[PhotoCheckRequest], PhotoCheckResponse],
    body: EndPaperSession,
) -> dict:
    """Checks the photo. A failed photo leaves the session running for one more try."""
    active = require_active(store, "paper")
    minutes = (end - datetime.fromisoformat(active["start"])).total_seconds() / 60
    request = PhotoCheckRequest(task=active["task"], code_word=active["codeWord"], minutes=minutes,
                                image_base64=body.imageBase64, media_type=body.mediaType)
    result = check(request).model_dump()
    attempts = active.get("photoAttempts", 0) + 1
    if not result["verified"] and attempts < MAX_PAPER_PHOTO_ATTEMPTS:
        store.set_active({**active, "photoAttempts": attempts})
        return {"completed": False, "retryable": True,
                "attemptsRemaining": MAX_PAPER_PHOTO_ATTEMPTS - attempts, "result": result}
    return finish(store, active, end, result,
                  plant_for(active.get("plant"), result["credited_minutes"]))


def require_active(store: SessionStore, kind: str) -> dict:
    active = store.get_active()
    if not active or active["kind"] != kind:
        raise SessionError(409, f"no {kind} session is running")
    return active


def finish(
    store: SessionStore, active: dict, end: datetime, result: dict, plant: dict,
    blocks: list[dict] | None = None,
) -> dict:
    """Saves the validated result and clears the running session."""
    session = {"id": str(uuid.uuid4()), "kind": active["kind"], "task": active["task"],
               "start": active["start"], "end": end.isoformat(), "result": result, "plant": plant}
    if blocks is not None:
        session["blocks"] = blocks  # so the review screen can show what each block was
    store.save_session(session)
    store.set_active(None)
    if active.get("trackerTaskId"):
        try:
            tracker.stop_task(store, end, active["trackerTaskId"])
        except SessionError:
            pass  # the user deleted the task while the session ran
    return session


class Review(BaseModel):
    label: Literal["on_task", "off_task", "break"]


def review_block(store: SessionStore, session_id: str, block_id: str, label: str) -> dict:
    """The user's decision on a block from the review screen. Stats are recomputed by code."""
    session = next((s for s in store.history() if s["id"] == session_id), None)
    if not session or session["kind"] != "computer":
        raise SessionError(404, "session not found")
    result = session["result"]
    item = next((l for l in result["labels"] if l["block_id"] == block_id), None)
    if item is None:
        raise SessionError(404, "block not found")
    item.update(label=label, confidence=1, source="user", reason="you reviewed this")
    result["needs_review"] = [i for i in result["needs_review"] if i != block_id]
    result["stats"] = compute_stats(
        [FinalLabel.model_validate(l) for l in result["labels"]]).model_dump()
    session["plant"] = plant_for(session["plant"], result["stats"]["on_task_minutes"])
    store.update_session(session)
    return session
