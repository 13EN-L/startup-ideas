# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FocusGarden: one Windows-local Python program (system tray) that also serves the FocusGarden web page at `http://127.0.0.1:8765/` — there is no browser extension. The user sets a task, works normally, and at session end Claude labels each activity block as `on_task` / `off_task` / `break` / `unclear`. Verified on-task minutes grow plants. Paper sessions are verified by a photo containing a session code word. Primary dev platform is Windows (PowerShell).

## Commands

Backend (uses `uv`, Python ≥3.11; run from repo root):

```powershell
uv sync --project backend --extra test --inexact
uv run --project backend --extra test --no-sync pytest backend\tests
# single file / single test
uv run --project backend --extra test --no-sync pytest backend\tests\test_label_endpoint.py
uv run --project backend --extra test --no-sync pytest backend\tests\test_label_endpoint.py -k retry
```

If Windows reports a locked `focusgarden_local_backend-*.dist-info`, don't delete it — use `--no-sync`.

Run the backend from source (from `backend/`):

```powershell
uv run --no-sync uvicorn app.server:app --host 127.0.0.1 --port 8765   # plain server
uv run --no-sync python -m app.launcher --console --port 8765          # launcher w/ visible logs (no tray)
```

Needs `ACTIVITYWATCH_EXECUTABLE` (e.g. `C:\Program Files\ActivityWatch\aw-qt.exe`) and optionally `ANTHROPIC_API_KEY` (and `CLAUDE_MODEL`). Interactive API docs at `http://127.0.0.1:8765/docs`.

Page tests (Node ≥18 built-in runner, no deps): `cd web; npm test`. Single file: `node --test tests/breakdown.test.js`. Open the page at `http://127.0.0.1:8765/` (tray → **Open FocusGarden**); it's served straight from `web/`, so edits show on reload.

Windows release build (PyInstaller + pinned ActivityWatch v0.14.1 → `backend\FocusGardenLocalBackend-windows-x86_64.zip`):

```powershell
uv sync --project backend --extra build --inexact
uv run --project backend --extra build --no-sync python backend\build_release.py
```

Also runs in CI via `.github/workflows/build-windows-release.yml` (on `v*` tags / manual dispatch).

Accuracy eval against real Claude (costs API credits): from `backend/`, `uv run --no-sync python ..\eval\run_eval.py`.

## Architecture

One local program on `http://127.0.0.1:8765` serves both the page and its API.

**Backend (`backend/app/`)** — one FastAPI app, built by the `create_app()` factory in `main.py`. Dependencies (labeler, photo reader, ActivityWatch manager, shared secret, `SessionStore`, clock `now`, `web_root`) are injected as arguments and stored on `app.state`; tests pass fakes from `backend/tests/fakes.py` (`FakeLabeler`, `FakePhotoReader`, `FakeActivityWatch`, `FakeClock`), so tests never call Claude or a real ActivityWatch. Entry points:
- `server.py` — module-level production `app` wiring real `ClaudeLabeler`/`ClaudePhotoReader`, a `SessionStore` at `~/.focusgarden/sessions.json`, and starting ActivityWatch in the lifespan.
- `launcher.py` — the packaged exe's entry: system-tray (pystray/tkinter) app whose default item **Open FocusGarden** opens the page (`page_url()`); it also finds the bundled ActivityWatch, manages the saved Claude API key (`~/.focusgarden/anthropic_api_key`, via `config.py`), and runs uvicorn. CLI flags `--token`, `--anthropic-api-key`, `--host`, `--port`, `--console`.
- `claude.py` is the **only** module that calls the LLM: official `anthropic` SDK (2.x), `client.beta.messages.create` with JSON-schema structured outputs (`output_config.format`), server-side refusal fallbacks (`fallbacks="default"`, beta `server-side-fallback-2026-07-01`); `refusal`/`max_tokens` stop reasons raise. Default model `claude-opus-5-5`, override with `CLAUDE_MODEL`. Tests use a recording fake client (`tests/test_claude.py`).

Request flow:
- Page API `/api/*` (`sessions.py`, routes in `main.py` on an `APIRouter`): start/end computer and paper sessions, block review, history, settings. State lives in `store.py` (one JSON file; in-memory when no path). Ending a computer session runs the `/activity` pipeline + `label_session` in-process; plant choice/growth is `plants.py`. Domain errors raise `SessionError(status, detail)`. A `require_same_origin` dependency rejects requests whose `Origin` isn't the program (403); there is no CORS middleware.
- Tasks & groups `/api/tracker*` (`tracker.py`): tasks with tags (groups) and running intervals, stored via `store.tasks()`. Tasks are **only** created by starting a session: `tracker.track_session` continues the task with the same name or creates one (`trackerTaskId` on the running session); `sessions.finish` stops it and saves `taskId` on the session. There are no routes to create/start/stop tasks; `PATCH` (groups, name) and `DELETE` only; there is no task-level done — a task stops when its session's Done ends it. `summarize()` returns per-task/group/total `{work_seconds, idle_seconds, sessions, stats}` for today (`since` param = client's local midnight) and all time, plus `session_ids`; `stats` is `stats.overlap_stats` (paper credit = on-task, rest unclear; sessions of different tasks that overlap in time count each moment once, on-task if on-task for any). Group/total time = interval **union**; idle = ActivityWatch AFK spans (`afk_between` in `main.py`) inside running time, cached on intervals once settled. `SessionError` lives in `errors.py` to avoid a sessions↔tracker import cycle.
- AFK events: `formatting.normalize_event` treats only `status == "afk"` as idle; `to_activity_window` drops `not-afk` spans.
- Static: `GET /` redirects to `/ui/`; `/ui` and `/plants` are mounted from `web_root` (`config.default_web_root()`: repo `web/`, also `web/` inside the PyInstaller bundle — `build_release.py` adds it with `--add-data`).
- `/activity` and `/usage`: `activitywatch.py` reads ActivityWatch buckets → `formatting.py` privacy-filters (URLs reduced to hostname + title + search text, never full URLs) and converts to the `ActivityWindow` contract. `/usage` is the verbose diagnostic variant (`models.py`); `/activity` is the compact window sessions are labeled from (`contracts.py`).
- `/label` (`labeling.py`): idle blocks and user allow/block-list matches are labeled by code (`source: rule`/`override`; blocklist wins) and never sent to the LLM. Remaining blocks go to Claude; output is validated (schema + every block labeled exactly once), and validator errors are fed back as feedback for up to `MAX_RETRIES = 2` retries. Confidence < 0.6 → `unclear`/`low_confidence`; still-missing blocks → `unclear`/`unlabeled`. Stats are computed by code in `stats.py`, never by the LLM.
- `/photo-check` (`photo.py`): Claude reports what it sees; the backend decides credit (100% / 50% if low confidence / 0%) with exact code-word matching.
- Auth: `/activity`, `/usage`, `/label`, `/photo-check`, `/claude-status` check `X-Flora-Secret` with `hmac.compare_digest` only when a secret is configured; `/api/*` never uses it (same-origin only). Missing Claude key → 503; Claude failure → 502.
- Secret env var naming is inconsistent: `server.py` reads `FLORA_SHARED_SECRET`, falling back to `FOCUSGARDEN_EXTENSION_TOKEN` (from `config.py`); the launcher sets both from `--token`.

**Page (`web/`)** — plain ES modules, no build step, `// @ts-check` JSDoc style, no `chrome.*` APIs.
- `ui/api.js` is the **only** module that makes HTTP calls (same-origin `/api/*`, `/health`). `ui/app.js` (main page, `index.html`: the start form, the only place tasks are named, and one card per running session, each with its own Done), `ui/tracker.js` (the Tasks & groups section below it on the same page: group chips, combined stats and breakdowns) and `ui/settings.js` only render; `ui/breakdownView.js` builds the split bar / site list elements both use; `ui/dom.js` has shared `$`/`h`/formatters; `ui/trackerTotals.js` (pure, node-tested) advances running timers between 30s refreshes. After starting a session / saving a result the page posts `{type: "sessionStarted"}` / `{type: "sessionSaved"}` on a `BroadcastChannel("focusgarden")` so other tabs refresh.
- Result breakdowns (`ui/breakdown.js`) are computed on the page from final labels, so review decisions recompute them. Plant art and `plants.json` live in `plants/`. The LLM never controls plant growth.

## Contracts

`docs/contracts.md` is the source of truth for data formats between the page, the session API and the activity/LLM routes. When a format changes, update `docs/contracts.md`, `docs/examples/`, and `backend/app/contracts.py` together — `backend/tests/test_activity_contract.py` fails if `docs/examples/activity-window.json` stops matching the Pydantic model.

## Repo notes

- `.claude/skills/tdd/` holds a project TDD skill.
- `.github/ideas/` contains earlier startup-idea writeups, not code.
