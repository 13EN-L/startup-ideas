"""Productivity stats, computed by code from validated labels (never by the LLM)."""
from typing import List

from app.contracts import FinalLabel, Stats


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
