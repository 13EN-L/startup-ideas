# FocusGarden local backend

This directory contains the Windows-local program used by the Chrome
extension. It runs one FastAPI application on `127.0.0.1:8765`, launches the
bundled ActivityWatch recorder, returns privacy-filtered activity, and hosts
the LLM labeling and paper-photo routes. There is no separate port-8000
service in the current architecture.

The extension-side request and response formats are documented in
[`docs/contracts.md`](../docs/contracts.md).

## Install the packaged program

Download `FocusGardenLocalBackend-windows-x86_64.zip` from a release, then:

1. Extract the zip, for example to `C:\FocusGarden`.
2. Open the extracted `FocusGardenLocalBackend` folder.
3. Double-click `FocusGardenLocalBackend.exe`.
4. Look for the FocusGarden leaf icon in the Windows notification area
   (system tray). The program runs in the background without an open terminal.
5. Open `http://127.0.0.1:8765/health` and confirm `reachable` is `true`.

The zip includes Python, the backend dependencies, and ActivityWatch. No
separate Python or ActivityWatch installation is needed. To run it at Windows
login, create a shortcut to the executable in the Startup folder
(`Windows + R`, then `shell:startup`). Right-click the tray icon to open the
health page or quit the backend.

### Turn FocusGarden off

To stop FocusGarden for the current Windows session:

1. Find the green FocusGarden leaf in the notification area. If it is hidden,
   click the small `^` arrow near the clock.
2. Right-click the leaf icon.
3. Select **Quit FocusGarden**.

This stops the local API and the entire ActivityWatch process tree launched by
FocusGarden, including `aw-server` and watcher processes.
It does not uninstall anything or delete ActivityWatch's locally stored
history. ActivityWatch writes that history to its Windows user-data directory,
separate from the extracted `FocusGardenLocalBackend` program folder. The
recorded history remains available after FocusGarden is started again, and
deleting the extracted release folder does not intentionally delete it.

The Chrome extension remains installed but cannot start a session while the
local program is off. Start the executable again to turn FocusGarden back on.
If you created a shortcut in `shell:startup`, Windows will start it again at
the next sign-in; remove that shortcut if you do not want automatic startup.

Only data that ActivityWatch has received before shutdown is available. If you
quit immediately while a new event is still being collected, allow a short
moment for the event to reach ActivityWatch before quitting.

Do not use Task Manager to stop only ActivityWatch: the backend may still be
running, and the extension will then receive recorder-unavailable errors.

To protect extension-facing routes with a shared secret:

```powershell
.\FocusGardenLocalBackend.exe --token "local-extension-token" `
  --google-api-key "your-google-api-key"
```

Configure the extension's `sharedSecret` with the same token. The extension
sends it as `X-Flora-Secret`. Do not commit or publish the Google API key.
Create a Google AI Studio API key, then provide it to the local program with
`--google-api-key`; never put it in the Chrome extension.

## Verify the extension-facing API

```powershell
$headers = @{ "X-Flora-Secret" = "local-extension-token" }
$start = (Get-Date).ToUniversalTime().AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ssZ")
$end = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8765/activity?start=$start&end=$end" `
  -Headers $headers | ConvertTo-Json -Depth 10
```

The response must contain `start`, `end`, and `blocks`. The extension uses
`/activity` for computer sessions. `/usage` returns the more verbose
diagnostic format; `/label` and `/photo-check` are served by this same
process.

### Local API and authentication reference

The packaged program listens only on `127.0.0.1` by default, so these routes
are intended for the local extension and local testing:

| Method and route | Authentication | Purpose |
|---|---|---|
| `GET /health` | None | Reports whether ActivityWatch is reachable and whether FocusGarden started it |
| `GET /activity?start=...&end=...` | `X-Flora-Secret` when a token is configured | Canonical extension activity window |
| `GET /usage?start=...&end=...&include_raw=false` | `X-Flora-Secret` when a token is configured | Verbose diagnostic usage response |
| `POST /label` | `X-Flora-Secret` when a token is configured | Labels activity blocks with Gemini |
| `POST /photo-check` | `X-Flora-Secret` when a token is configured | Checks a paper-study photo with Gemini |

`start` and `end` must be timezone-aware ISO-8601 timestamps, and `end` must
be after `start`. Activity requests are limited to seven days by default.
When no shared secret is configured, the protected routes accept local
requests without a token. When a secret is configured, a missing or incorrect
`X-Flora-Secret` returns HTTP 401. A missing Google API key causes `/label`
and `/photo-check` to return HTTP 503; activity collection and `/health` do
not require the Google API.

### Runtime configuration

For source mode, these environment variables provide the same configuration
as the packaged command-line options:

| Variable | Default | Purpose |
|---|---|---|
| `GOOGLE_API_KEY` or `GEMINI_API_KEY` | empty | Google AI Studio key for Gemini labeling/photo checks |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Gemini model name |
| `FOCUSGARDEN_EXTENSION_TOKEN` | empty | Shared secret expected in `X-Flora-Secret` |
| `FOCUSGARDEN_HOST` | `127.0.0.1` | Local API bind address |
| `FOCUSGARDEN_PORT` | `8765` | Local API port |
| `ACTIVITYWATCH_EXECUTABLE` | auto-detected in release | ActivityWatch executable path |
| `ACTIVITYWATCH_START_COMMAND` | empty | Alternative command for starting ActivityWatch |
| `ACTIVITYWATCH_URL` | `http://127.0.0.1:5600` | ActivityWatch API address |
| `ACTIVITYWATCH_TIMEOUT_SECONDS` | `5` | ActivityWatch request timeout |
| `FOCUSGARDEN_MAX_WINDOW_SECONDS` | `604800` | Maximum requested activity window (7 days) |

The packaged launcher also accepts `--token`, `--google-api-key`, `--host`,
`--port`, and `--console`. Command-line values override the corresponding
launcher defaults. Keep API keys and shared secrets out of Git and out of the
Chrome extension; only the shared secret is sent between the extension and
local backend.

## Use paper-session photo checks

Paper sessions use the same local backend and Google API key:

1. In the extension, send `{"type": "startPaperSession", "task": "finish
   chemistry problem set 4"}`.
2. Display the returned `codeWord` and write it at the top of the study page.
3. Study for the session.
4. Take a clear photo showing the code word and task-related notes.
5. Convert the image to base64 and send `endPaperSession` with
   `imageBase64` and its `mediaType` (`image/jpeg`, `image/png`, or
   `image/webp`).

The service worker sends this request to:

```text
POST http://127.0.0.1:8765/photo-check
```

The backend sends the image and task to Gemini 3.8 Flash. Gemini returns
whether it saw the exact code word, whether notes are present, whether the
notes relate to the task, and a confidence score. The backend—not the model—
decides the credit:

| Result | Credit |
|---|---:|
| Code word matches, notes are present and task-related, confidence is at least 0.6 | 100% of session minutes |
| The code word matches, notes are present and task-related, but confidence is below 0.6 | 50% of session minutes |
| Wrong/missing code word, no notes, unrelated notes, model failure, or invalid output | 0% of session minutes |

Photos are sent to Gemini for checking and are not saved by this backend after
the request. Do not use a photo containing unrelated sensitive information.

For a direct API test, save a test image as `paper-test.jpg`, then run:

```powershell
$bytes = [IO.File]::ReadAllBytes((Resolve-Path ".\paper-test.jpg"))
$image = [Convert]::ToBase64String($bytes)
$body = @{
  task = "finish chemistry problem set 4"
  code_word = "maple"
  minutes = 25
  image_base64 = $image
  media_type = "image/jpeg"
} | ConvertTo-Json -Compress
$headers = @{ "X-Flora-Secret" = "local-extension-token" }
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:8765/photo-check" `
  -Headers $headers -ContentType "application/json" -Body $body |
  ConvertTo-Json
```

Expected response shape:

```json
{
  "verified": true,
  "credited_minutes": 25.0,
  "reason": "code word and task notes found"
}
```

This requires the backend to be started with `--google-api-key`. Without a
Google API key, the endpoint returns HTTP 503. The extension permits two photo
submissions for a paper session. A failed first attempt stays active and
returns `attemptsRemaining`; the session is finalized after a successful
verification or the second failed attempt. The automated tests use fake photo
readers to verify validation, retries, exact code-word matching, zero credit
for clear failures, and limited partial credit; they do not call Gemini or
consume API credits.

## Run from source

From the repository root:

```powershell
uv sync --project backend --extra test --inexact
uv run --project backend --extra test --no-sync pytest backend\tests
```

To run the local service from source, set the ActivityWatch executable and
start the unified production app:

```powershell
cd backend
$env:ACTIVITYWATCH_EXECUTABLE = "C:\Program Files\ActivityWatch\aw-qt.exe"
$env:FLORA_SHARED_SECRET = "local-extension-token"
$env:GOOGLE_API_KEY = "your-google-api-key"
uv run --no-sync uvicorn app.server:app --host 127.0.0.1 --port 8765
```

If Windows reports that a `focusgarden_local_backend-*.dist-info` directory is
locked, do not delete it while it is in use. Run with `--no-sync`, or close
Python/VS Code processes that use the virtual environment before synchronizing.
When running from source, use `--console` if you want visible Uvicorn logs
instead of the tray:

```powershell
uv run --no-sync python -m app.launcher --console --port 8765
```

Press `Ctrl+C` in this console to stop the source-mode backend. In the normal
packaged release, use the tray menu instead.

## Build a Windows release

The release builder downloads and verifies ActivityWatch v0.14.1, freezes the
Python service, and creates a zip containing both programs:

```powershell
uv sync --project backend --extra build --inexact
uv run --project backend --extra build --no-sync python backend\build_release.py
```

The packaged executable is a windowed system-tray application, and the result
is `backend\FocusGardenLocalBackend-windows-x86_64.zip`. On
OneDrive, a clean build environment or a release directory outside OneDrive
may avoid Windows file-lock and hardlink errors.

## Accuracy evaluation

This command uses API credits:

```powershell
cd backend
uv run --no-sync python ..\eval\run_eval.py
```

## Layout

| File | What it does |
|---|---|
| `app/contracts.py` | Pydantic models for requests, responses, and LLM output |
| `app/main.py` | Unified FastAPI routes and shared-secret check |
| `app/server.py` | Production entry point and runtime configuration |
| `app/activitywatch.py` | Starts ActivityWatch and reads local events |
| `app/formatting.py` | Privacy filtering and `/activity` conversion |
| `app/labeling.py` | Rules, LLM retry loop, and confidence handling |
| `app/stats.py` | On-task minutes, percentage, and longest streak |
| `app/photo.py` | Code-word match and partial credit |
| `app/gemini.py` | The only code that calls Gemini 3.8 Flash |
| `../extension/background/` | Chrome service-worker clients for local activity and LLM routes |
