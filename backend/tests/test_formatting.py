from datetime import datetime, timezone

from app.formatting import bucket_source, normalize_event
from app.formatting import to_activity_window
from app.models import UsageEvent


START = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)
END = datetime(2026, 10, 21, 13, 0, tzinfo=timezone.utc)


def test_browser_event_is_privacy_filtered_and_clipped() -> None:
    result = normalize_event(
        {
            "timestamp": "2026-10-21T11:59:30+00:00",
            "duration": 120,
            "data": {
                "url": "https://www.google.com/search?q=study+plan&secret=omit",
                "title": "Study plan",
            },
        },
        "browser",
        START,
        END,
    )

    assert result is not None
    assert result.site == "www.google.com"
    assert result.search == "study plan"
    assert result.start == START
    assert result.duration_seconds == 90


def test_invalid_duration_is_ignored() -> None:
    assert normalize_event({"duration": "bad", "data": {}}, "desktop", START, END) is None


def test_bucket_source_uses_watcher_names() -> None:
    assert bucket_source({"id": "aw-watcher-web-chrome"}) == "browser"
    assert bucket_source({"id": "aw-watcher-window"}) == "desktop"
    assert bucket_source({"id": "aw-watcher-afk"}) == "idle"


def test_activity_window_merges_adjacent_matching_events() -> None:
    events = [
        UsageEvent(
            source="browser",
            start=START,
            end=START.replace(minute=0, second=30),
            duration_seconds=30,
            site="docs.google.com",
            title="Chem PS4",
        ),
        UsageEvent(
            source="browser",
            start=START.replace(minute=0, second=30),
            end=START.replace(minute=1),
            duration_seconds=30,
            site="docs.google.com",
            title="Chem PS4",
        ),
    ]

    window = to_activity_window(events, START, END)

    assert len(window.blocks) == 1
    assert window.blocks[0].seconds == 60
