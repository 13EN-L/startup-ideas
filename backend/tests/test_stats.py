from app.contracts import FinalLabel
from app.stats import compute_stats


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
