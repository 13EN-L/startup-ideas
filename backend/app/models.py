from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class UsageQuery(BaseModel):
    start: datetime
    end: datetime
    include_raw: bool = False

    @field_validator("start", "end")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamps must include a timezone offset")
        return value


class UsageEvent(BaseModel):
    source: Literal["browser", "desktop", "idle", "unknown"]
    start: datetime
    end: datetime
    duration_seconds: float = Field(ge=0)
    site: str | None = None
    title: str | None = None
    search: str | None = None
    application: str | None = None
    idle: bool | None = None


class UsageResponse(BaseModel):
    start: datetime
    end: datetime
    event_count: int
    total_active_seconds: float
    total_idle_seconds: float
    events: list[UsageEvent]
    raw_events: list[dict[str, Any]] | None = None


class ActivityWatchStatus(BaseModel):
    reachable: bool
    managed_process_running: bool
    base_url: str
    detail: str | None = None
