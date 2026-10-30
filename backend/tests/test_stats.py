from app.contracts import FinalLabel
from app.stats import compute_stats, overlap_stats


def block(block_id, minutes, label):
    return FinalLabel(block_id=block_id, seconds=minutes * 60, label=label,
                      confidence=0.9, reason="", source="llm")


def test_all_on_task_session_is_100_percent():
    stats = compute_stats([block("b1", 20, "on_task"), block("b2", 10, "on_task")])
    assert stats.total_minutes == 30
    assert stats.on_task_minutes == 30
    assert stats.on_task_pct == 100.0
    assert stats.longest_streak_minutes == 30


def test_mixed_session_streak_resets_on_off_task_block():
    # 10 on, 5 off, 15 on, 5 on, 5 break -> 40 min, 30 on-task (75%), best streak 20
    stats = compute_stats([
        block("b1", 10, "on_task"),
        block("b2", 5, "off_task"),
        block("b3", 15, "on_task"),
        block("b4", 5, "on_task"),
        block("b5", 5, "break"),
    ])
    assert stats.on_task_minutes == 30
    assert stats.off_task_minutes == 5
    assert stats.break_minutes == 5
    assert stats.on_task_pct == 75.0
    assert stats.longest_streak_minutes == 20


def test_empty_session_reports_zero_not_an_error():
    stats = compute_stats([])
    assert stats.total_minutes == 0
    assert stats.on_task_pct == 0.0


def saved_computer_session(session_id, start_minute, blocks):
    """A saved session from (start minute, minutes, label) blocks, back to back from 14:00."""
    at = lambda minute: f"2026-10-21T14:{minute:02d}:00+00:00"
    labels = [block(f"b{i}", minutes, label) for i, (_, minutes, label) in enumerate(blocks)]
    return {
        "id": session_id, "kind": "computer", "start": at(start_minute),
        "end": at(blocks[-1][0] + blocks[-1][1]),
        "result": {"labels": [l.model_dump() for l in labels],
                   "stats": compute_stats(labels).model_dump()},
        "blocks": [{"id": f"b{i}", "start": at(minute)} for i, (minute, _, _) in enumerate(blocks)],
    }


def test_sessions_that_never_overlap_count_as_they_were_saved():
    first = saved_computer_session("a", 0, [(0, 20, "on_task"), (20, 10, "off_task")])
    second = saved_computer_session("b", 40, [(40, 15, "on_task")])

    stats = overlap_stats([first, second])

    assert stats.total_minutes == 45
    assert stats.on_task_minutes == 35
    assert stats.longest_streak_minutes == 20


def test_overlapping_sessions_count_each_minute_once_on_task_if_on_task_for_any():
    # chem ps4: 14:00-14:20 on, 14:20-14:30 off. essay: 14:10-14:30 off, 14:30-14:40 on.
    chem = saved_computer_session("a", 0, [(0, 20, "on_task"), (20, 10, "off_task")])
    essay = saved_computer_session("b", 10, [(10, 20, "off_task"), (30, 10, "on_task")])
    paper = {"id": "c", "kind": "paper", "start": "2026-10-21T15:00:00+00:00",
             "end": "2026-10-21T15:20:00+00:00",
             "result": {"verified": True, "credited_minutes": 20, "reason": ""}}

    stats = overlap_stats([essay, paper, chem])

    # 14:00-14:20 on (chem), 14:20-14:30 off (both), 14:30-14:40 on (essay), then 20 paper min.
    assert stats.total_minutes == 60
    assert stats.on_task_minutes == 50
    assert stats.off_task_minutes == 10
    assert round(stats.on_task_pct, 1) == 83.3
    assert stats.longest_streak_minutes == 20
