# Data contracts

This file defines how the FocusGarden page, the session API and the activity/LLM routes of the local program pass data to each other. If a format changes, update this file, [`docs/examples/`](examples/) and `backend/app/contracts.py` in the same PR. `backend/tests/test_activity_contract.py` fails if the example stops matching.

```
Page (web/ui) --same-origin /api/...--> sessions.py --activity window + /label pipeline--> Claude
```

Everything runs in one local program on `http://127.0.0.1:8765`; it also serves the page.

## 1. Activity window

Ending a computer session builds this window in-process. Direct callers can fetch it with:

```
GET http://127.0.0.1:8765/activity?start=<ISO 8601>&end=<ISO 8601>
```

The request must include the same `X-Flora-Secret` header used by `/label` and
`/photo-check` when the program is started with `--token`.

It expects this response (full example: [`examples/activity-window.json`](examples/activity-window.json)):

```json
{
  "start": "2026-10-21T14:00:00Z",
  "end": "2026-10-21T15:00:00Z",
  "blocks": [
    {"id": "b1", "start": "2026-10-21T14:00:00Z", "seconds": 1500, "kind": "web",
     "app": "Google Chrome", "site": "docs.google.com", "title": "Chem PS4 - Google Docs"},
    {"id": "b3", "start": "2026-10-21T14:32:00Z", "seconds": 300, "kind": "idle"}
  ]
}
```

| Field | Rule |
|---|---|
| `id` | Unique within the window. Any short string works. |
| `start` | ISO 8601. Blocks must be in time order. |
| `seconds` | Whole seconds, 0 or more. |
| `kind` | `web` (browser tab), `app` (desktop app) or `idle` (AFK). Idle blocks count as breaks and are never sent to the LLM. |
| `app` | App name, for example `Google Chrome` or `Discord`. Can be left out for idle blocks. |
| `site` | Hostname only, such as `docs.google.com`. **Never send full URLs.** Required for `web` blocks, `null` otherwise. |
| `title` | Page or window title. Search queries show up here, for example `"le chatelier principle - Google Search"`. |

**Merge small events.** ActivityWatch records many tiny events. Merge consecutive events with the same `site`/`app` and `title`, and drop blocks shorter than about 10 seconds. Fewer blocks means fewer tokens and a cheaper LLM call.

## 2. Page → program: session API

The page calls these with `fetch` (only from `web/ui/api.js`). Errors are HTTP status codes with `{"detail": "..."}`. Requests whose `Origin` is not the program itself get `403`.

| Request | Response |
|---|---|
| `POST /api/sessions` `{task, allowlist?, blocklist?}` | The new running session, with its `id`. Other sessions keep running. `409` if a session for the same task (ignoring case) is already running. |
| `POST /api/sessions/{id}/end` | Ends that running computer session (its Done button). A saved session with the same `id` (see below). This can take a few seconds while the LLM runs. `502`/`503` if labeling fails; the session keeps running. `404` if no computer session with that `id` is running. |
| `POST /api/paper-sessions` `{task}` | The new running session, including `id` and `codeWord`; `409` as above. Show it to the user to write at the top of their page. |
| `POST /api/paper-sessions/{id}/end` `{imageBase64, mediaType}` | A saved session, or `{completed: false, retryable: true, attemptsRemaining, result}` after a failed first photo. `mediaType` is `image/jpeg`, `image/png` or `image/webp`. |
| `POST /api/sessions/{id}/blocks/{block_id}/review` `{label}` | The updated saved session. `label` is `on_task`, `off_task` or `break`. |
| `GET /api/active` | The running sessions, oldest first (`[]` if none). Several tasks can run at once. |
| `GET /api/history` | An array of saved sessions, oldest first. |
| `GET /api/settings`, `PUT /api/settings` `{distractingSites}` | `{distractingSites: [...]}` (lowercased, blanks dropped). |

### Tasks and groups

Tasks are created only by starting a session: `POST /api/sessions` or `POST /api/paper-sessions` continues the task with the same name (ignoring case) or creates one, and its timer runs until the session ends. The running session's `trackerTaskId` is that task, and the saved session records it as `taskId`.

| Request | Response |
|---|---|
| `GET /api/tracker?since=<ISO 8601>` | A summary (below). `since` is the start of the user's local day. |
| `PATCH /api/tracker/tasks/{id}` `{name?, tags?}` | The task. `tags` replaces its groups. A task stops only when its session ends. |
| `DELETE /api/tracker/tasks/{id}` | `{deleted: id}`. `404` if there is no such task. Its sessions stay in history. |

```json
{
  "tasks": [{"id": "uuid", "name": "chem ps4", "tags": ["Chem"], "running": true,
             "session_ids": ["uuid", "uuid"],
             "today": {"work_seconds": 2520, "idle_seconds": 180, "sessions": 1,
                       "stats": {"total_minutes": 45, "on_task_minutes": 35, "off_task_minutes": 6,
                                 "break_minutes": 3, "unclear_minutes": 1, "on_task_pct": 77.8,
                                 "longest_streak_minutes": 25}},
             "all": {"work_seconds": 9000, "idle_seconds": 600, "sessions": 4, "stats": {...}}}],
  "groups": [{"name": "Chem", "running": true, "session_ids": [...], "today": {...}, "all": {...}}],
  "total": {"running": true, "session_ids": [...], "today": {...}, "all": {...}},
  "activitywatch": true
}
```

- `tags` are the task's groups; a task can be in several. Group names match ignoring case and are sorted.
- Group and `total` times are the **union** of their tasks' running intervals, so nothing counts twice.
- `idle_seconds` is time ActivityWatch's AFK watcher marked as away while a timer ran; `work_seconds` is the rest. `activitywatch` is `false` when idle couldn't be checked, in which case that time counts as work.
- `stats` has the saved-session stats shape, combined by code over the saved sessions (`sessions` of them; `today` counts sessions that started at or after `since`): minutes add up, `on_task_pct` is recomputed, `longest_streak_minutes` is the longest single streak. Sessions that ran at the same time (different tasks) are counted moment by moment instead: each moment once, labeled `on_task` if any of them was on-task then, otherwise `off_task`, `break`, then `unclear`. A paper session counts `credited_minutes` as on-task and the rest of its length as unclear. `session_ids` (all time, oldest first) lets the page build site/app breakdowns from `GET /api/history`.
- Sessions saved before `taskId` existed belong to the task whose timer interval started at the session's `start`.

When a session starts the page posts `{type: "sessionStarted"}`, and when a result is saved `{type: "sessionSaved", session}`, on the `BroadcastChannel` named `focusgarden`, so other open FocusGarden tabs can update without polling.

`allowlist` and `blocklist` take entries like `instructure.com` (which also matches subdomains) or `Discord` (an app name). The blocklist wins if both match. The running session's `blocklist` already includes the distracting sites from settings, minus the allowlist.

### Saved session

```json
{
  "id": "uuid", "kind": "computer", "task": "finish chem ps4", "taskId": "uuid",
  "start": "...", "end": "...",
  "plant": {"name": "Strawberry", "gif": "plants/strawberry_stages.gif", "minutesToFullGrowth": 60,
            "minutes": 40, "progress": 0.667, "percent": 66, "minutesLeft": 20},
  "result": {
    "labels": [{"block_id": "b1", "seconds": 1500, "label": "on_task", "confidence": 0.93,
                "reason": "chem problem set document", "source": "llm"}],
    "stats": {"total_minutes": 60, "on_task_minutes": 40, "off_task_minutes": 8, "break_minutes": 5,
              "unclear_minutes": 7, "on_task_pct": 66.7, "longest_streak_minutes": 25},
    "needs_review": ["b2"]
  }
}
```

- **`label`:** one of `on_task`, `off_task`, `break` or `unclear`. Blocks listed in `needs_review` are `unclear` and are meant for the review screen.
- **`source`:** explains where a label came from:
  - `llm`: Claude's label;
  - `rule`: idle time;
  - `override`: the user's allowlist or blocklist;
  - `low_confidence`: Claude wasn't sure (its reason is kept);
  - `unlabeled`: Claude failed validation after 2 retries;
  - `user`: the user resolved it on the review screen.
- **Paper sessions:** `result` is `{verified, credited_minutes, reason}`. A verified photo gets full minutes. An ambiguous but plausible photo can get 50%; clear failures get 0%.
- **`plant`:** is selected and grown by the program's code in
  `backend/app/plants.py`; it is never decided by the LLM.
- **`blocks`:** computer sessions also keep the activity blocks they were labeled from, so the review screen can show what each one was.

## 3. Activity and LLM routes

When the program is started with `--token`, `GET /activity`, `GET /usage`,
`GET /claude-status`, `POST /label` and `POST /photo-check` require the
header `X-Flora-Secret`. The page never calls these directly.
These routes, `/activity`, `/usage`, and `/health` are served by the same
local process on port 8765. The request and response shapes are the Pydantic
models in [`backend/app/contracts.py`](../backend/app/contracts.py). FastAPI
also serves them as interactive docs at
`http://127.0.0.1:8765/docs` while the backend is running.

`GET /claude-status` makes a minimal Claude request and returns
`{"status":"ok","model":"claude-opus-5-5"}` when the saved key works. A
`502` response includes the provider error without exposing the API key.

## Ownership

The page (`web/ui/`, `web/plants/`) only renders and computes
display breakdowns (`breakdown.js`, per session or combined over a task's or
group's sessions) and live timer counting (`trackerTotals.js`). The program
under `backend/` owns sessions, tasks and groups (with their combined stats), storage, plant growth, the ActivityWatch bridge and Claude calls.
