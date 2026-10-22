# Data contracts between Parts 1, 2 and 3

This file defines how the three parts pass data to each other. If a format changes, update this file, [`docs/examples/`](examples/) and `backend/app/contracts.py` in the same PR. `backend/tests/test_activity_contract.py` fails if the example stops matching.

```
Local packaged backend --GET /activity--> Part 2 (service worker) --POST /label--> same backend --> Gemini 3.8 Flash
Part 3 (UI) <--chrome.runtime messages--> Part 2 (service worker)
```

## 1. Part 1 → Part 2: activity window

The service worker calls Part 1's local backend:

```
GET http://127.0.0.1:8765/activity?start=<ISO 8601>&end=<ISO 8601>
```

The request must include the same `X-Flora-Secret` header used by `/label` and
`/photo-check` when the packaged backend is configured with a secret.

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

## 2. Part 3 → Part 2: service worker messages

Send these with `chrome.runtime.sendMessage(msg)`. Every reply is either `{ok: true, data}` or `{ok: false, error}`.

| Message | `data` in the reply |
|---|---|
| `{type: "startSession", task, allowlist?, blocklist?}` | `null` |
| `{type: "endSession"}` | A saved session (see below). This can take a few seconds while the LLM runs. |
| `{type: "startPaperSession", task}` | `{codeWord}`. Show this word to the user to write at the top of their page. |
| `{type: "endPaperSession", imageBase64, mediaType}` | A saved session. `mediaType` is `image/jpeg`, `image/png` or `image/webp`. |
| `{type: "getActive"}` | The running session, or `null`. |
| `{type: "getHistory"}` | An array of saved sessions. |

When a result is saved, the service worker also broadcasts `{type: "sessionSaved", session}`, so an open garden view can update without polling.

`allowlist` and `blocklist` take entries like `instructure.com` (which also matches subdomains) or `Discord` (an app name). The blocklist wins if both match.

### Saved session

```json
{
  "id": "uuid", "kind": "computer", "task": "finish chem ps4",
  "start": "...", "end": "...",
  "plant": {"species": "sunflower", "growth": 2},
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
  - `llm`: Gemini's label;
  - `rule`: idle time;
  - `override`: the user's allowlist or blocklist;
  - `low_confidence`: Gemini wasn't sure (its reason is kept);
  - `unlabeled`: Gemini failed validation after 2 retries.
- **Paper sessions:** `result` is `{verified, credited_minutes, reason}`. A verified photo gets full minutes. An ambiguous but plausible photo can get 50%; clear failures get 0%.
- **`plant`:** is selected and grown by the extension's code in
  `extension/background/plantRules.js`; it is never decided by the LLM.

## 3. Part 2 → local backend

`GET /gemini-status`, `POST /label` and `POST /photo-check` must send the
header `X-Flora-Secret`.
These routes, `/activity`, `/usage`, and `/health` are served by the same
local process on port 8765. The request and response shapes are the Pydantic
models in [`backend/app/contracts.py`](../backend/app/contracts.py). FastAPI
also serves them as interactive docs at
`http://127.0.0.1:8765/docs` while the backend is running.

`GET /gemini-status` makes a minimal Gemini request and returns
`{"status":"ok","model":"gemini-3.8-flash"}` when the saved key works. A
`502` response includes the provider error without exposing the API key.

## Extension ownership

The Chrome extension owns [`extension/manifest.json`](../extension/manifest.json),
the popup/options UI, service worker, browser storage, and plant rendering.
The local program owns the ActivityWatch bridge and Gemini calls under
`backend/`. The extension communicates with the local program only over the
documented localhost HTTP endpoints above.

```json
{
  "background": {"service_worker": "background/service-worker.js", "type": "module"},
  "permissions": ["storage"],
  "host_permissions": ["http://127.0.0.1/*", "https://<backend>.onrender.com/*"]
}
```
