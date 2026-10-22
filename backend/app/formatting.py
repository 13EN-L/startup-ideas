from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qs, urlparse

from .models import UsageEvent
from .contracts import ActivityBlock, ActivityWindow


def _datetime(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _site(value: Any) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    parsed = urlparse(value if "://" in value else f"https://{value}")
    return parsed.hostname


def _search(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    query = parse_qs(urlparse(value).query)
    for key in ("q", "query", "search_query", "text"):
        if query.get(key):
            return query[key][0][:200]
    return None


def normalize_event(
    event: dict[str, Any],
    source: str,
    window_start: datetime,
    window_end: datetime,
) -> UsageEvent | None:
    data = event.get("data")
    if not isinstance(data, dict):
        data = {}
    start = _datetime(event.get("timestamp")) or window_start
    duration = event.get("duration")
    if not isinstance(duration, (int, float)) or duration < 0:
        return None
    end = start.timestamp() + float(duration)
    start_seconds = max(start.timestamp(), window_start.timestamp())
    end_seconds = min(end, window_end.timestamp())
    if end_seconds <= start_seconds:
        return None
    clipped_start = datetime.fromtimestamp(start_seconds, tz=timezone.utc)
    clipped_end = datetime.fromtimestamp(end_seconds, tz=timezone.utc)
    normalized_source = (
        "browser" if source == "browser" else
        "desktop" if source == "desktop" else
        "idle" if source == "idle" else "unknown"
    )
    raw_url = data.get("url") or data.get("href")
    return UsageEvent(
        source=normalized_source,
        start=clipped_start,
        end=clipped_end,
        duration_seconds=round(end_seconds - start_seconds, 3),
        site=_site(raw_url),
        title=data.get("title") if isinstance(data.get("title"), str) else None,
        search=_search(raw_url),
        application=(
            data.get("app") if isinstance(data.get("app"), str)
            else data.get("application") if isinstance(data.get("application"), str)
            else None
        ),
        idle=_is_idle(normalized_source, data),
    )


def _is_idle(source: str, data: dict[str, Any]) -> bool:
    """ActivityWatch's AFK watcher records both {"status": "afk"} and {"status": "not-afk"}."""
    if source != "idle":
        return False
    if "status" in data:
        return data["status"] == "afk"
    if "idle" in data:
        return bool(data["idle"])
    return True


def bucket_source(bucket: dict[str, Any]) -> str:
    identifier = " ".join(
        str(bucket.get(key, "")).lower()
        for key in ("id", "name", "type", "client")
    )
    if "browser" in identifier or "chrome" in identifier or "firefox" in identifier:
        return "browser"
    if "idle" in identifier or "afk" in identifier:
        return "idle"
    if "window" in identifier or "app" in identifier or "afk" not in identifier:
        return "desktop"
    return "unknown"


BROWSER_APPS = ("chrome", "chromium", "edge", "firefox", "safari", "brave", "arc", "opera", "vivaldi")


def _is_browser(app: str) -> bool:
    return any(name in app.lower() for name in BROWSER_APPS)


def to_activity_window(
    events: list[UsageEvent],
    start: datetime,
    end: datetime,
    minimum_seconds: int = 10,
) -> ActivityWindow:
    """Turn overlapping watcher events into one non-overlapping list of blocks.

    ActivityWatch's watchers all record at once, so each second is decided by
    priority: idle wins; otherwise the focused window; and when that window is
    a browser, the browser watcher's tab supplies the site and title. Without
    window data (no permission or watcher), browser events are used directly.
    """
    total = int((end - start).total_seconds())
    # One slot per second: (kind, app, site, title), or None when nothing was recorded.
    timeline: list[tuple[str, str, str | None, str | None] | None] = [None] * total

    def span(event: UsageEvent) -> range:
        first = max(0, round((event.start - start).total_seconds()))
        last = min(total, round((event.end - start).total_seconds()))
        return range(first, last)

    windows = [e for e in events if e.source == "desktop"]
    tabs = [e for e in events if e.source == "browser"]
    for event in windows:
        slot = ("app", event.application or "", None, event.title)
        for second in span(event):
            timeline[second] = slot
    for event in tabs:
        for second in span(event):
            focused = timeline[second]
            if windows and (focused is None or not _is_browser(focused[1])):
                continue  # a background tab while another app had focus
            app = focused[1] if focused else (event.application or "")
            timeline[second] = ("web", app, event.site, event.title)
    for event in events:
        if event.idle:
            for second in span(event):
                timeline[second] = ("idle", "", None, None)

    # Run-length encode, then drop short blips and re-join what they split.
    runs: list[tuple[int, int, tuple]] = []  # (first second, length, slot)
    for second, slot in enumerate(timeline):
        if slot is None:
            continue
        if runs and runs[-1][2] == slot and runs[-1][0] + runs[-1][1] == second:
            runs[-1] = (runs[-1][0], runs[-1][1] + 1, slot)
        else:
            runs.append((second, 1, slot))
    kept: list[tuple[int, int, tuple]] = []
    for run in runs:
        if run[1] < minimum_seconds:
            continue
        if kept and kept[-1][2] == run[2]:
            kept[-1] = (kept[-1][0], kept[-1][1] + run[1], run[2])
        else:
            kept.append(run)

    blocks = [
        ActivityBlock(
            id=f"b{index}",
            start=start + timedelta(seconds=first),
            seconds=length,
            kind=kind,
            app=app,
            site=site,
            title=title,
        )
        for index, (first, length, (kind, app, site, title)) in enumerate(kept, start=1)
    ]
    return ActivityWindow(start=start, end=end, blocks=blocks)
