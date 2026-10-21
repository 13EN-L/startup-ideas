from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .activitywatch import ActivityWatchError, ActivityWatchManager
from .config import settings
from .formatting import bucket_source, normalize_event
from .models import ActivityWatchStatus, UsageEvent, UsageQuery, UsageResponse


app = FastAPI(title="FocusGarden Local Usage Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^chrome-extension://[a-zA-Z0-9]+$",
    allow_origins=["http://localhost", "http://127.0.0.1"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Authorization", "Content-Type"],
)
activitywatch = ActivityWatchManager(
    settings.activitywatch_url,
    settings.activitywatch_executable,
    settings.activitywatch_start_command,
    settings.request_timeout_seconds,
)


def require_token(authorization: str | None = Header(default=None)) -> None:
    if not settings.extension_token:
        return
    expected = f"Bearer {settings.extension_token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="invalid extension token")


def validate_window(query: UsageQuery) -> tuple[datetime, datetime]:
    start = query.start.astimezone(timezone.utc)
    end = query.end.astimezone(timezone.utc)
    seconds = (end - start).total_seconds()
    if end <= start:
        raise HTTPException(status_code=422, detail="end must be after start")
    if seconds > settings.max_window_seconds:
        raise HTTPException(
            status_code=422,
            detail=f"time range cannot exceed {settings.max_window_seconds} seconds",
        )
    return start, end


def collect_usage(
    start: datetime,
    end: datetime,
    include_raw: bool,
) -> UsageResponse:
    try:
        activitywatch.ensure_running()
        buckets = activitywatch.buckets()
        events: list[UsageEvent] = []
        raw: list[dict[str, Any]] = []
        for bucket in buckets:
            bucket_id = bucket.get("id")
            if not isinstance(bucket_id, str):
                continue
            source = bucket_source(bucket)
            bucket_events = activitywatch.events(
                bucket_id, start.isoformat(), end.isoformat()
            )
            for event in bucket_events:
                normalized = normalize_event(event, source, start, end)
                if normalized is not None:
                    events.append(normalized)
                    if include_raw:
                        raw.append(event)
    except ActivityWatchError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    events.sort(key=lambda event: event.start)
    return UsageResponse(
        start=start,
        end=end,
        event_count=len(events),
        total_active_seconds=round(
            sum(event.duration_seconds for event in events if not event.idle), 3
        ),
        total_idle_seconds=round(
            sum(event.duration_seconds for event in events if event.idle), 3
        ),
        events=events,
        raw_events=raw if include_raw else None,
    )


@app.get("/health", response_model=ActivityWatchStatus)
def health(_: None = Depends(require_token)) -> ActivityWatchStatus:
    reachable = activitywatch.is_reachable()
    return ActivityWatchStatus(
        reachable=reachable,
        managed_process_running=activitywatch.process_running,
        base_url=activitywatch.base_url,
        detail=None if reachable else "ActivityWatch is not reachable",
    )


@app.get("/usage", response_model=UsageResponse)
def usage(
    start: datetime = Query(...),
    end: datetime = Query(...),
    include_raw: bool = Query(False),
    _: None = Depends(require_token),
) -> UsageResponse:
    try:
        query = UsageQuery(start=start, end=end, include_raw=include_raw)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail="timestamps must include a timezone offset",
        ) from exc
    window_start, window_end = validate_window(query)
    return collect_usage(window_start, window_end, include_raw)
"""FastAPI service that holds the Claude key and labels study sessions."""
import hmac
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException

from app.contracts import LabelRequest, LabelResponse, PhotoCheckRequest, PhotoCheckResponse
from app.labeling import label_session
from app.photo import check_photo


def create_app(labeler, shared_secret: str, photo_reader: Optional[object] = None) -> FastAPI:
    app = FastAPI(title="Flora LLM backend")

    def require_secret(x_flora_secret: str = Header(default="")) -> None:
        if not hmac.compare_digest(x_flora_secret, shared_secret):
            raise HTTPException(status_code=401, detail="bad or missing X-Flora-Secret")

    @app.post("/label", response_model=LabelResponse, dependencies=[Depends(require_secret)])
    def label(request: LabelRequest) -> LabelResponse:
        return label_session(request, labeler)

    @app.post("/photo-check", response_model=PhotoCheckResponse,
              dependencies=[Depends(require_secret)])
    def photo_check(request: PhotoCheckRequest) -> PhotoCheckResponse:
        return check_photo(request, photo_reader)

    return app
