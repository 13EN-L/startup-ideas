"""Productivity stats, computed by code from validated labels (never by the LLM)."""
from datetime import datetime, timedelta
from typing import Iterable, Iterator, List

from app.contracts import FinalLabel, Stats

# Where sessions of different tasks overlap, a moment takes the first label any of them gave
# it: on-task for any running task counts as on-task.
LABEL_PRIORITY = ("on_task", "off_task", "break", "unclear")
Segment = tuple[datetime, datetime, str]


def compute_stats(labels: List[FinalLabel]) -> Stats:
    """Labels must be in time order; a streak is a run of consecutive on-task blocks."""
    minutes = {"on_task": 0, "off_task": 0, "break": 0, "unclear": 0}
    longest = streak = 0
    for item in labels:
        minutes[item.label] += item.seconds
        streak = streak + item.seconds if item.label == "on_task" else 0
        longest = max(longest, streak)

    total = sum(minutes.values())
    return Stats(
        total_minutes=total / 60,
        on_task_minutes=minutes["on_task"] / 60,
        off_task_minutes=minutes["off_task"] / 60,
        break_minutes=minutes["break"] / 60,
        unclear_minutes=minutes["unclear"] / 60,
        on_task_pct=100 * minutes["on_task"] / total if total else 0.0,
        longest_streak_minutes=longest / 60,
    )


def session_stats(session: dict) -> Stats:
    """A saved session's stats. A paper session's credited minutes are on-task (one streak);
    the rest of it wasn't verified, so it counts as unclear."""
    if session["kind"] == "computer":
        return Stats.model_validate(session["result"]["stats"])
    minutes = (datetime.fromisoformat(session["end"])
               - datetime.fromisoformat(session["start"])).total_seconds() / 60
    credited = min(session["result"]["credited_minutes"], minutes)
    return Stats(
        total_minutes=minutes,
        on_task_minutes=credited,
        off_task_minutes=0,
        break_minutes=0,
        unclear_minutes=minutes - credited,
        on_task_pct=100 * credited / minutes if minutes else 0.0,
        longest_streak_minutes=credited,
    )


def combine_stats(stats: Iterable[Stats]) -> Stats:
    """Several sessions' stats as one: minutes add up and the percentage is recomputed from
    them. Streaks don't run across sessions, so the longest is the longest single one."""
    stats = list(stats)
    total = sum(s.total_minutes for s in stats)
    on_task = sum(s.on_task_minutes for s in stats)
    return Stats(
        total_minutes=total,
        on_task_minutes=on_task,
        off_task_minutes=sum(s.off_task_minutes for s in stats),
        break_minutes=sum(s.break_minutes for s in stats),
        unclear_minutes=sum(s.unclear_minutes for s in stats),
        on_task_pct=100 * on_task / total if total else 0.0,
        longest_streak_minutes=max((s.longest_streak_minutes for s in stats), default=0),
    )


def _span(session: dict) -> tuple[datetime, datetime]:
    return datetime.fromisoformat(session["start"]), datetime.fromisoformat(session["end"])


def _segments(session: dict) -> Iterator[Segment]:
    """A saved session's labeled time. A paper session's credited minutes come first."""
    if session["kind"] == "computer":
        blocks = {b["id"]: b for b in session.get("blocks", [])}
        for label in session["result"]["labels"]:
            if label["block_id"] in blocks:
                start = datetime.fromisoformat(blocks[label["block_id"]]["start"])
                yield start, start + timedelta(seconds=label["seconds"]), label["label"]
        return
    start, end = _span(session)
    credited = min(timedelta(minutes=session["result"]["credited_minutes"]), end - start)
    yield start, start + credited, "on_task"
    yield start + credited, end, "unclear"


def _overlapping_stats(sessions: list[dict]) -> Stats:
    """Sessions that ran at the same time, with each moment counted once."""
    segments = [s for session in sessions for s in _segments(session) if s[1] > s[0]]
    points = sorted({t for start, end, _ in segments for t in (start, end)})
    seconds = dict.fromkeys(LABEL_PRIORITY, 0.0)
    longest = streak = 0.0
    for start, end in zip(points, points[1:]):
        labels = {label for s, e, label in segments if s <= start and e >= end}
        if not labels:
            continue  # like compute_stats, a gap between blocks doesn't break a streak
        label = next(l for l in LABEL_PRIORITY if l in labels)
        length = (end - start).total_seconds()
        seconds[label] += length
        streak = streak + length if label == "on_task" else 0
        longest = max(longest, streak)
    total = sum(seconds.values())
    return Stats(
        total_minutes=total / 60,
        on_task_minutes=seconds["on_task"] / 60,
        off_task_minutes=seconds["off_task"] / 60,
        break_minutes=seconds["break"] / 60,
        unclear_minutes=seconds["unclear"] / 60,
        on_task_pct=100 * seconds["on_task"] / total if total else 0.0,
        longest_streak_minutes=longest / 60,
    )


def overlap_stats(sessions: Iterable[dict]) -> Stats:
    """Stats over saved sessions that may have run at the same time (several tasks at once).
    A session that overlapped no other counts exactly as it was saved; where sessions overlap,
    each moment counts once, as on-task if it was on-task for any of them."""
    clusters: list[list[dict]] = []
    cluster_end = None
    for session in sorted(sessions, key=lambda s: _span(s)[0]):
        start, end = _span(session)
        if clusters and start < cluster_end:
            clusters[-1].append(session)
            cluster_end = max(cluster_end, end)
        else:
            clusters.append([session])
            cluster_end = end
    return combine_stats(session_stats(c[0]) if len(c) == 1 else _overlapping_stats(c)
                         for c in clusters)
