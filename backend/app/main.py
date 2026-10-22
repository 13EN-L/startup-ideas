from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import hmac
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .activitywatch import ActivityWatchError, ActivityWatchManager
from .config import settings
from .contracts import (
    ActivityWindow,
    LabelRequest,
    LabelResponse,
    PhotoCheckRequest,
    PhotoCheckResponse,
)
from .formatting import bucket_source, normalize_event, to_activity_window
from .labeling import label_session
from .models import ActivityWatchStatus, UsageEvent, UsageQuery, UsageResponse
from .photo import check_photo


def create_app(
    labeler: Optional[object] = None,
    shared_secret: str = "",
    photo_reader: Optional[object] = None,
    activitywatch_manager: Optional[ActivityWatchManager] = None,
    start_activitywatch: bool = False,
) -> FastAPI:
    manager = activitywatch_manager or ActivityWatchManager(
        settings.activitywatch_url,
        settings.activitywatch_executable,
        settings.activitywatch_start_command,
        settings.request_timeout_seconds,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if start_activitywatch:
            manager.startup()
        yield
        manager.close()

    app = FastAPI(
        title="FocusGarden Local Backend",
        version="0.2.0",
        lifespan=lifespan,
    )
    app.state.activitywatch = manager
    app.state.labeler = labeler
    app.state.photo_reader = photo_reader
    app.state.shared_secret = shared_secret
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^chrome-extension://[a-zA-Z0-9]+$",
        allow_origins=["http://localhost", "http://127.0.0.1"],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type", "X-Flora-Secret"],
    )

    def require_secret(x_flora_secret: str = Header(default="")) -> None:
        if shared_secret and not hmac.compare_digest(x_flora_secret, shared_secret):
            raise HTTPException(status_code=401, detail="bad or missing X-Flora-Secret")

    def validate_window(start: datetime, end: datetime) -> tuple[datetime, datetime]:
        if start.tzinfo is None or start.utcoffset() is None:
            raise HTTPException(status_code=422, detail="start must include a timezone offset")
        if end.tzinfo is None or end.utcoffset() is None:
            raise HTTPException(status_code=422, detail="end must include a timezone offset")
        start_utc = start.astimezone(timezone.utc)
        end_utc = end.astimezone(timezone.utc)
        seconds = (end_utc - start_utc).total_seconds()
        if end_utc <= start_utc:
            raise HTTPException(status_code=422, detail="end must be after start")
        if seconds > settings.max_window_seconds:
            raise HTTPException(
                status_code=422,
                detail=f"time range cannot exceed {settings.max_window_seconds} seconds",
            )
        return start_utc, end_utc

    def collect_usage(start: datetime, end: datetime, include_raw: bool) -> UsageResponse:
        try:
            manager.ensure_running()
            buckets = manager.buckets()
            events: list[UsageEvent] = []
            raw: list[dict[str, Any]] = []
            for bucket in buckets:
                bucket_id = bucket.get("id")
                if not isinstance(bucket_id, str):
                    continue
                source = bucket_source(bucket)
                for event in manager.events(bucket_id, start.isoformat(), end.isoformat()):
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

    def require_labeler() -> object:
        if app.state.labeler is None:
            raise HTTPException(status_code=503, detail="LLM labeling is not configured")
        return app.state.labeler

    def require_photo_reader() -> object:
        if app.state.photo_reader is None:
            raise HTTPException(status_code=503, detail="LLM photo checking is not configured")
        return app.state.photo_reader

    @app.get("/health", response_model=ActivityWatchStatus)
    def health() -> ActivityWatchStatus:
        reachable = manager.is_reachable()
        detail = None if reachable else (
            manager.startup_error or "ActivityWatch is not reachable"
        )
        return ActivityWatchStatus(
            reachable=reachable,
            managed_process_running=manager.process_running,
            base_url=manager.base_url,
            detail=detail,
        )

    @app.get("/activity", response_model=ActivityWindow, dependencies=[Depends(require_secret)])
    def activity(
        start: datetime = Query(...),
        end: datetime = Query(...),
    ) -> ActivityWindow:
        window_start, window_end = validate_window(start, end)
        usage_response = collect_usage(window_start, window_end, include_raw=False)
        return to_activity_window(
            usage_response.events,
            usage_response.start,
            usage_response.end,
        )

    @app.get("/usage", response_model=UsageResponse, dependencies=[Depends(require_secret)])
    def usage(
        start: datetime = Query(...),
        end: datetime = Query(...),
        include_raw: bool = Query(False),
    ) -> UsageResponse:
        window_start, window_end = validate_window(start, end)
        return collect_usage(window_start, window_end, include_raw)

    @app.post(
        "/label",
        response_model=LabelResponse,
        dependencies=[Depends(require_secret)],
    )
    def label(request: LabelRequest) -> LabelResponse:
        return label_session(request, require_labeler())

    @app.post(
        "/photo-check",
        response_model=PhotoCheckResponse,
        dependencies=[Depends(require_secret)],
    )
    def photo_check(request: PhotoCheckRequest) -> PhotoCheckResponse:
        return check_photo(request, require_photo_reader())

    return app


activitywatch = ActivityWatchManager(
    settings.activitywatch_url,
    settings.activitywatch_executable,
    settings.activitywatch_start_command,
    settings.request_timeout_seconds,
)

app = create_app(
    shared_secret=settings.extension_token,
    activitywatch_manager=activitywatch,
    start_activitywatch=False,
)
