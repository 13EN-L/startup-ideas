"""The time tracker: task timers that run alongside focus sessions.

A task has tags (its groups) and a list of running intervals. Totals for a group or for
everything are the union of the intervals involved, so overlapping tasks never
double-count.
"""
from __future__ import annotations

from datetime import datetime
from datetime import timedelta
from typing import Callable, Iterable, Optional
import uuid

from pydantic import BaseModel, Field

from .errors import SessionError
from .store import SessionStore

Interval = tuple[datetime, datetime]
# AFK spans ActivityWatch recorded between two times, or None if it can't be reached.
IdleLookup = Callable[[datetime, datetime], Optional[list[Interval]]]
# ActivityWatch marks AFK a few minutes after the fact, so only settled intervals are cached.
IDLE_SETTLE_TIME = timedelta(minutes=5)


class NewTask(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    tags: list[str] = []
    running: bool = True


class TaskChanges(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    tags: Optional[list[str]] = None
    done: Optional[bool] = None


def union(intervals: Iterable[Interval]) -> list[Interval]:
    """Merges overlapping or touching intervals."""
    merged: list[Interval] = []
    for start, end in sorted(i for i in intervals if i[1] > i[0]):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def clip(intervals: Iterable[Interval], start: datetime, end: datetime) -> list[Interval]:
    return [(max(s, start), min(e, end)) for s, e in intervals if min(e, end) > max(s, start)]


def intersect(a: list[Interval], b: list[Interval]) -> list[Interval]:
    """Both lists must already be merged (see union)."""
    return [(max(s1, s2), min(e1, e2)) for s1, e1 in a for s2, e2 in b if min(e1, e2) > max(s1, s2)]


def seconds(intervals: Iterable[Interval]) -> int:
    return round(sum((end - start).total_seconds() for start, end in intervals))


def clean_tags(tags: Iterable[str]) -> list[str]:
    """Trimmed, blanks dropped, duplicates (ignoring case) dropped, first spelling kept."""
    seen: dict[str, str] = {}
    for tag in tags:
        if tag.strip() and tag.strip().casefold() not in seen:
            seen[tag.strip().casefold()] = tag.strip()
    return list(seen.values())


def create_task(store: SessionStore, now: datetime, body: NewTask) -> dict:
    task = {"id": str(uuid.uuid4()), "name": body.name.strip(), "tags": clean_tags(body.tags),
            "done": False, "intervals": []}
    if body.running:
        task["intervals"].append({"start": now.isoformat(), "end": None})
    store.save_tasks([*store.tasks(), task])
    return task


def _update(store: SessionStore, task_id: str, change) -> dict:
    tasks = store.tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if task is None:
        raise SessionError(404, "task not found")
    change(task)
    store.save_tasks(tasks)
    return task


def start_task(store: SessionStore, now: datetime, task_id: str) -> dict:
    def start(task: dict) -> None:
        if not _running(task):
            task["intervals"].append({"start": now.isoformat(), "end": None})
    return _update(store, task_id, start)


def stop_task(store: SessionStore, now: datetime, task_id: str) -> dict:
    def stop(task: dict) -> None:
        if _running(task):
            task["intervals"][-1]["end"] = now.isoformat()
    return _update(store, task_id, stop)


def edit_task(store: SessionStore, now: datetime, task_id: str, changes: TaskChanges) -> dict:
    def edit(task: dict) -> None:
        if changes.name is not None:
            task["name"] = changes.name.strip()
        if changes.tags is not None:
            task["tags"] = clean_tags(changes.tags)
        if changes.done is not None:
            task["done"] = changes.done
            if changes.done and _running(task):
                task["intervals"][-1]["end"] = now.isoformat()  # a finished task stops
    return _update(store, task_id, edit)


def delete_task(store: SessionStore, task_id: str) -> None:
    tasks = store.tasks()
    if not any(t["id"] == task_id for t in tasks):
        raise SessionError(404, "task not found")
    store.save_tasks([t for t in tasks if t["id"] != task_id])


def track_session(store: SessionStore, now: datetime, name: str) -> Optional[str]:
    """A focus session also runs as a tracker task: an unfinished task with the same name
    (ignoring case), or a new one. Returns the task's id if the session started its timer,
    so ending the session stops only a timer it started."""
    task = next((t for t in store.tasks()
                 if not t["done"] and t["name"].casefold() == name.strip().casefold()), None)
    if task is None:
        return create_task(store, now, NewTask(name=name))["id"]
    if _running(task):
        return None
    return start_task(store, now, task["id"])["id"]


def _intervals(task: dict, now: datetime) -> list[Interval]:
    return [(datetime.fromisoformat(i["start"]),
             datetime.fromisoformat(i["end"]) if i["end"] else now) for i in task["intervals"]]


def _running(task: dict) -> bool:
    return bool(task["intervals"]) and task["intervals"][-1]["end"] is None


def _idle(task: dict, now: datetime, idle_between: IdleLookup) -> tuple[list[Interval], bool]:
    """AFK spans inside the task's intervals, and whether ActivityWatch answered for all of
    them. Settled intervals keep their spans so history isn't re-read on every refresh."""
    spans: list[Interval] = []
    complete = True
    for interval in task["intervals"]:
        start = datetime.fromisoformat(interval["start"])
        end = datetime.fromisoformat(interval["end"]) if interval["end"] else now
        if "idle" in interval:
            found = [(datetime.fromisoformat(s), datetime.fromisoformat(e)) for s, e in interval["idle"]]
        else:
            found = idle_between(start, end)
            if found is None:
                complete = False
                continue
            found = union(clip(found, start, end))
            if interval["end"] and now - end >= IDLE_SETTLE_TIME:
                interval["idle"] = [[s.isoformat(), e.isoformat()] for s, e in found]
        spans += found
    return spans, complete


def _totals(work: list[Interval], idle: list[Interval], now: datetime, since: datetime) -> dict:
    def split(start: Optional[datetime]) -> dict:
        active = union(clip(work, start, now) if start else work)
        away = intersect(union(clip(idle, start, now) if start else idle), active)
        return {"work_seconds": seconds(active) - seconds(away), "idle_seconds": seconds(away)}
    return {"today": split(since), "all": split(None)}


def summarize(store: SessionStore, now: datetime, since: datetime, idle_between: IdleLookup) -> dict:
    """Work and idle seconds, today (from `since`) and all time, per task, per tag and in total.
    Idle is ActivityWatch AFK time while a task was running; work is the rest."""
    stored = store.tasks()
    tasks = []
    groups: dict[str, dict] = {}  # by tag ignoring case; the first spelling names the group
    everything: dict[str, list[Interval]] = {"work": [], "idle": []}
    activitywatch_ok = True
    for task in stored:
        work = _intervals(task, now)
        idle, complete = _idle(task, now, idle_between)
        activitywatch_ok = activitywatch_ok and complete
        everything["work"] += work
        everything["idle"] += idle
        tasks.append({"id": task["id"], "name": task["name"], "tags": task["tags"],
                      "done": task["done"], "running": _running(task),
                      **_totals(work, idle, now, since)})
        for tag in task["tags"]:
            group = groups.setdefault(tag.casefold(),
                                      {"name": tag, "work": [], "idle": [], "running": False})
            group["work"] += work
            group["idle"] += idle
            group["running"] = group["running"] or _running(task)
    store.save_tasks(stored)  # keeps idle spans cached by _idle
    return {
        "tasks": tasks,
        "groups": [{"name": g["name"], "running": g["running"],
                    **_totals(g["work"], g["idle"], now, since)}
                   for g in sorted(groups.values(), key=lambda g: g["name"].casefold())],
        "total": {"running": any(t["running"] for t in tasks),
                  **_totals(everything["work"], everything["idle"], now, since)},
        "activitywatch": activitywatch_ok,
    }
