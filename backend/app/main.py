from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import hmac
from pathlib import Path
from typing import Any, Callable, Optional
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from .activitywatch import ActivityWatchError, ActivityWatchManager
from .config import default_web_root, settings
from .contracts import (
    ActivityWindow,
    LabelRequest,
    LabelResponse,
    PhotoCheckRequest,
    PhotoCheckResponse,
)
from .formatting import bucket_source, normalize_event, to_activity_window
from .labeling import LLMUnavailableError, label_session
from .models import ActivityWatchStatus, UsageEvent, UsageQuery, UsageResponse
from .photo import check_photo
from .plants import choose_plant, plant_for
from . import sessions, tracker
from .errors import SessionError
from .store import SessionStore


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_app(
    labeler: Optional[object] = None,
    shared_secret: str = "",
    photo_reader: Optional[object] = None,
    activitywatch_manager: Optional[ActivityWatchManager] = None,
    start_activitywatch: bool = False,
    store: Optional[SessionStore] = None,
    now: Callable[[], datetime] = _utc_now,
    web_root: Optional[Path] = None,
) -> FastAPI:
    web_root = web_root or default_web_root()
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
    app.state.store = store = store or SessionStore()

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

    def afk_between(start: datetime, end: datetime) -> Optional[list[tuple[datetime, datetime]]]:
        """Spans ActivityWatch's AFK watcher marked as away, or None if it can't be reached."""
        try:
            manager.ensure_running()
            spans = []
            for bucket in manager.buckets():
                bucket_id = bucket.get("id")
                if not isinstance(bucket_id, str) or bucket_source(bucket) != "idle":
                    continue
                for event in manager.events(bucket_id, start.isoformat(), end.isoformat()):
                    normalized = normalize_event(event, "idle", start, end)
                    if normalized is not None and normalized.idle:
                        spans.append((normalized.start, normalized.end))
            return spans
        except ActivityWatchError:
            return None

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

    @app.get("/claude-status", dependencies=[Depends(require_secret)])
    def claude_status() -> dict[str, str]:
        if app.state.labeler is None:
            raise HTTPException(status_code=503, detail="Claude is not configured (no API key)")
        try:
            app.state.labeler.test_connection()
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Claude request failed: {exc}") from exc
        return {"status": "ok", "model": app.state.labeler.model}

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
        try:
            return label_session(request, require_labeler())
        except LLMUnavailableError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @app.post(
        "/photo-check",
        response_model=PhotoCheckResponse,
        dependencies=[Depends(require_secret)],
    )
    def photo_check(request: PhotoCheckRequest) -> PhotoCheckResponse:
        return check_photo(request, require_photo_reader())

    # ---- The FocusGarden page's API (docs/contracts.md section 2) ----

    def require_same_origin(request: Request) -> None:
        """Only the page this app serves may use it: another website open in the browser
        could otherwise start sessions or read history on this computer."""
        origin = request.headers.get("origin")
        if origin and urlsplit(origin).netloc != request.headers.get("host"):
            raise HTTPException(status_code=403, detail="cross-site requests are not allowed")

    api = APIRouter(prefix="/api", dependencies=[Depends(require_same_origin)])

    @app.exception_handler(SessionError)
    def session_error(_: Request, exc: SessionError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @api.get("/active")
    def get_active() -> Optional[dict]:
        return store.get_active()

    @api.post("/sessions")
    def start_session(body: sessions.StartSession) -> dict:
        return sessions.start_session(store, now(), body.task, body.allowlist, body.blocklist,
                                      choose_plant(web_root))

    @api.post("/sessions/end")
    def end_session() -> dict:
        active = sessions.require_active(store, "computer")
        end = now()
        usage_response = collect_usage(
            datetime.fromisoformat(active["start"]), end, include_raw=False
        )
        window = to_activity_window(usage_response.events, usage_response.start, end)
        request = LabelRequest(task=active["task"], blocks=window.blocks,
                               allowlist=active["allowlist"], blocklist=active["blocklist"])
        try:
            result = label_session(request, require_labeler())
        except LLMUnavailableError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return sessions.finish(store, active, end, result.model_dump(mode="json"),
                               plant_for(active.get("plant"), result.stats.on_task_minutes),
                               [block.model_dump(mode="json") for block in window.blocks])

    @api.post("/paper-sessions")
    def start_paper_session(body: sessions.StartPaperSession) -> dict:
        return sessions.start_paper_session(store, now(), body.task, choose_plant(web_root))

    @api.post("/paper-sessions/end")
    def end_paper_session(body: sessions.EndPaperSession) -> dict:
        def check(request: PhotoCheckRequest) -> PhotoCheckResponse:
            if app.state.photo_reader is None:
                return PhotoCheckResponse(verified=False, credited_minutes=0,
                                          reason="photo check unavailable: no API key is set")
            return check_photo(request, app.state.photo_reader)

        return sessions.end_paper_session(store, now(), check, body)

    @api.post("/sessions/{session_id}/blocks/{block_id}/review")
    def review_block(session_id: str, block_id: str, body: sessions.Review) -> dict:
        return sessions.review_block(store, session_id, block_id, body.label)

    @api.get("/settings")
    def get_settings() -> dict:
        return {"distractingSites": sessions.distracting_sites(store)}

    @api.put("/settings")
    def put_settings(body: sessions.Settings) -> dict:
        return sessions.save_settings(store, body)

    @api.get("/tracker")
    def get_tracker(since: datetime = Query(...)) -> dict:
        """Totals for the time tracker tab. `since` is the start of the user's local day."""
        return tracker.summarize(store, now(), since, afk_between)

    @api.post("/tracker/tasks")
    def create_tracker_task(body: tracker.NewTask) -> dict:
        return tracker.create_task(store, now(), body)

    @api.post("/tracker/tasks/{task_id}/start")
    def start_tracker_task(task_id: str) -> dict:
        return tracker.start_task(store, now(), task_id)

    @api.post("/tracker/tasks/{task_id}/stop")
    def stop_tracker_task(task_id: str) -> dict:
        return tracker.stop_task(store, now(), task_id)

    @api.patch("/tracker/tasks/{task_id}")
    def edit_tracker_task(task_id: str, body: tracker.TaskChanges) -> dict:
        return tracker.edit_task(store, now(), task_id, body)

    @api.delete("/tracker/tasks/{task_id}")
    def delete_tracker_task(task_id: str) -> dict:
        tracker.delete_task(store, task_id)
        return {"deleted": task_id}

    @api.get("/history")
    def get_history() -> list[dict]:
        return store.history()

    app.include_router(api)

    # ---- The page itself: open http://127.0.0.1:8765/ (the tray menu does this) ----

    @app.get("/", include_in_schema=False)
    def home() -> RedirectResponse:
        return RedirectResponse("/ui/")

    app.mount("/ui", StaticFiles(directory=web_root / "ui", html=True, check_dir=False))
    app.mount("/plants", StaticFiles(directory=web_root / "plants", check_dir=False))

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
