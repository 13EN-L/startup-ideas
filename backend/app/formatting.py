from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qs, urlparse

from .models import UsageEvent


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
        idle=(
            bool(data.get("idle"))
            if normalized_source == "idle" and "idle" in data
            else normalized_source == "idle"
        ),
    )


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
