# FocusGarden Testing and Demo Guide

This guide explains how to install, test, and demonstrate FocusGarden on
Windows. FocusGarden is one local program: it runs in the system tray, serves
the FocusGarden page at `http://127.0.0.1:8765/`, connects to ActivityWatch to
collect local browser/desktop/idle activity, and labels sessions with the LLM.

## What this guide tests

The complete flow is:

```text
Computer activity
    -> ActivityWatch
    -> FocusGarden local program
    -> Formatted JSON over localhost
    -> LLM labeling, stats and the FocusGarden page
```

The guide covers:

- Installing and launching the packaged backend
- Confirming ActivityWatch is available
- Running the automated backend tests
- Requesting real usage data
- Checking privacy filtering and error handling
- Opening the FocusGarden page from the tray
- Demonstrating the end-to-end session flow

## Option 1: Test the packaged Windows release

The packaged release includes the backend, Python runtime, required Python
packages, and ActivityWatch. A test computer does not need a separate Python
or ActivityWatch installation.

### 1. Obtain and extract the package

Download:

```text
FocusGardenLocalBackend-windows-x86_64.zip
```

Extract it to a convenient location, for example:

```text
C:\FocusGarden
```

Open the extracted application folder:

```text
C:\FocusGarden\FocusGardenLocalBackend
```

### 2. Launch the backend

Double-click:

```text
FocusGardenLocalBackend.exe
```

The executable is a system-tray application, so it does not open a terminal.
Look for the FocusGarden leaf icon in the Windows notification area. Right-
click it to set the Claude API key, open the health page, or quit the
application. Choose **Set Claude API key** and enter the key once; it is
stored locally and takes effect without restarting the backend. The backend
listens on:

```text
http://127.0.0.1:8765
```

The bundled ActivityWatch process is launched automatically while the backend
starts. The backend waits for ActivityWatch to become ready before reporting
successful recorder health.

For visible development logs in source mode, run the launcher from PowerShell
with `--console`:

```powershell
uv run --no-sync python -m app.launcher --console --port 8765
```

The packaged release normally runs without a terminal. Use the source-mode
launcher with `--console` when you need visible logs during development.

To turn the packaged program off, right-click the FocusGarden tray leaf and
select **Quit FocusGarden**. This stops the local API and the complete
ActivityWatch process tree (`aw-qt`, `aw-server`, and watcher processes). It
does not uninstall the program or erase local ActivityWatch history.
ActivityWatch stores that history in its Windows user-data directory, separate
from the extracted `FocusGardenLocalBackend` folder. Start the executable again
and previously recorded events remain available. Deleting the extracted
release folder does not intentionally delete this history.

Only events already received by ActivityWatch can be retained. For a clean
demo, wait a few seconds after generating activity before selecting **Quit
FocusGarden**. If the program was added to `shell:startup`, it will start again
at the next Windows sign-in; remove that shortcut to disable automatic startup.

### 3. Optional: protect the direct API routes

For a local demo without authentication, start the executable normally. The
FocusGarden page never needs a token.

To require a shared secret on `/activity`, `/usage`, `/label`,
`/photo-check` and `/claude-status` for direct callers, start it with:

```powershell
.\FocusGardenLocalBackend.exe --token "local-api-token"
```

Direct requests must then send:

```http
X-Flora-Secret: local-api-token
```

If you want LLM labeling or paper-photo checks, set your Claude API key with
the tray's **Set Claude API key**, or start it with:

```powershell
.\FocusGardenLocalBackend.exe `
  --anthropic-api-key "your-claude-api-key"
```

The key is for Claude (`claude-opus-5-5` by default; set `CLAUDE_MODEL` to change it). Keep it in the local
program; do not commit it to Git. It never reaches the page.

### 4. Test Claude connectivity

After saving the key, restart the packaged program so it loads the current
configuration. Then run:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8765/claude-status" `
  -Method Get
```

When Claude is reachable, the response is:

```json
{"status":"ok","model":"claude-opus-5-5"}
```

If you started the backend with `--token`, add:

```powershell
-Headers @{ "X-Flora-Secret" = "local-api-token" }
```

An HTTP 503 means the backend did not load an API key. An HTTP 502 means the
request reached the Claude integration but the provider rejected it or was
unreachable; inspect the response body for the provider's diagnostic detail.

## Option 2: Run from source

This option is intended for developers who are changing the backend.

From the repository root:

```powershell
cd "C:\path\to\startup-ideas"
uv sync --project backend --extra test --inexact
uv run --project backend --extra test pytest backend\tests
```

To run the server from source:

```powershell
cd "C:\path\to\startup-ideas\backend"
$env:ACTIVITYWATCH_EXECUTABLE = "C:\Program Files\ActivityWatch\aw-qt.exe"
$env:FOCUSGARDEN_EXTENSION_TOKEN = "local-api-token"
uv run uvicorn app.server:app --host 127.0.0.1 --port 8765
```

If Windows reports that a
`focusgarden_local_backend-*.dist-info` directory is locked, do not delete
that directory while it is in use. It is generated package metadata inside the
virtual environment. Run tests without synchronizing:

```powershell
uv run --no-sync --project backend --extra test pytest backend\tests
```

## Automated tests

Run:

```powershell
uv run --project backend --extra test pytest backend\tests
```

The expected result is:

```text
36 passed
```

The automated tests verify:

- Time ranges require time zones.
- Reversed time ranges are rejected.
- Events are clipped to the requested period.
- Browser URLs are reduced to hostname, title, and search information.
- ActivityWatch buckets are classified as browser, desktop, or idle.
- The `/health` and `/usage` endpoints return the expected JSON.

These tests mock ActivityWatch. They verify backend behavior, but they do not
verify that a real ActivityWatch installation is recording events. Use the
manual test below for that.

## Manual end-to-end test with real activity

### 1. Confirm the backend health endpoint

Open this URL in a browser:

```text
http://127.0.0.1:8765/health
```

Or run:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8765/health"
```

Expected response shape:

```json
{
  "reachable": true,
  "managed_process_running": false,
  "base_url": "http://127.0.0.1:5600",
  "detail": null
}
```

`reachable: true` means the backend can communicate with ActivityWatch.
`managed_process_running: true` means this backend launched the bundled
ActivityWatch process. It can be `false` when ActivityWatch was already
running before the backend started.

If authentication is enabled:

```powershell
$headers = @{
    "X-Flora-Secret" = "local-api-token"
}

Invoke-RestMethod `
    -Uri "http://127.0.0.1:8765/health" `
    -Headers $headers
```

### 2. Confirm ActivityWatch is recording

Open:

```text
http://127.0.0.1:5600
```

Use the ActivityWatch interface to confirm that events appear while you:

1. Open a browser tab.
2. Visit a course or work website.
3. Visit an unrelated website.
4. Switch between desktop applications.
5. Stop interacting briefly to create an idle period.

Browser events require ActivityWatch's browser watcher/browser extension to be
enabled. Desktop-window and idle events can be recorded independently.

### 3. Generate recent activity

For a clear test, create activity with recognizable page titles, such as:

- `Chemistry Problem Set 4`
- `Course Lecture Notes`
- `News Website`
- `YouTube Entertainment`

Spend several minutes moving between those pages and applications.

### 4. Request formatted usage data

Run this from PowerShell:

```powershell
$start = (Get-Date).ToUniversalTime().AddMinutes(-10).ToString("yyyy-MM-ddTHH:mm:ssZ")
$end = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$uri = "http://127.0.0.1:8765/usage?start=$start&end=$end"

Invoke-RestMethod -Uri $uri | ConvertTo-Json -Depth 10
```

With authentication:

```powershell
$headers = @{
    "X-Flora-Secret" = "local-api-token"
}

Invoke-RestMethod `
    -Uri $uri `
    -Headers $headers |
    ConvertTo-Json -Depth 10
```

Expected response shape:

```json
{
  "start": "2026-10-21T21:00:00Z",
  "end": "2026-10-21T21:10:00Z",
  "event_count": 3,
  "total_active_seconds": 540.0,
  "total_idle_seconds": 60.0,
  "events": [
    {
      "source": "browser",
      "start": "2026-10-21T21:01:00Z",
      "end": "2026-10-21T21:04:00Z",
      "duration_seconds": 180.0,
      "site": "docs.google.com",
      "title": "Chemistry Problem Set 4",
      "search": null,
      "application": null,
      "idle": false
    }
  ],
  "raw_events": null
}
```

The exact timestamps and events depend on what ActivityWatch recorded.

## Privacy-filtering test

Visit a search URL such as:

```text
https://www.google.com/search?q=chemistry+problem+set&private_value=omit
```

Request usage data again:

```powershell
Invoke-RestMethod -Uri $uri | ConvertTo-Json -Depth 10
```

The formatted event should contain information similar to:

```json
{
  "source": "browser",
  "site": "www.google.com",
  "title": "Chemistry Problem Set",
  "search": "chemistry problem set"
}
```

The full original URL and unrelated query parameters should not appear in the
normal response.

For local diagnostics only, request raw ActivityWatch events:

```powershell
Invoke-RestMethod `
    -Uri "$uri&include_raw=true" |
    ConvertTo-Json -Depth 20
```

Raw events can contain more identifying information. Do not send
`raw_events` to an LLM by default.

## Error-handling tests

### Missing timezone

```powershell
Invoke-RestMethod `
    -Uri "http://127.0.0.1:8765/usage?start=2026-10-21T12:00:00&end=2026-10-21T13:00:00"
```

Expected result: HTTP 422, because both timestamps need a timezone such as
`Z` or `-04:00`.

### Reversed range

```powershell
Invoke-RestMethod `
    -Uri "http://127.0.0.1:8765/usage?start=2026-10-21T13:00:00Z&end=2026-10-21T12:00:00Z"
```

Expected result: HTTP 422.

### Missing authentication

If the backend was started with `--token`, send a request without the
`X-Flora-Secret` header.

Expected result: HTTP 401.

### ActivityWatch unavailable

Stop ActivityWatch and request `/usage`.

Expected result: `/health` reports `reachable: false` with a diagnostic detail,
and a usage request returns HTTP 503 rather than a successful response
containing fabricated or empty usage data.

## Five-minute demo script

### Before the demo

1. Extract the packaged release.
2. Start `FocusGardenLocalBackend.exe` and confirm the tray icon appears.
3. Confirm `http://127.0.0.1:8765/health` returns `reachable: true`.
4. Confirm ActivityWatch is recording at `http://127.0.0.1:5600`.
5. Keep PowerShell, a browser, and the API endpoint available.

### Demo sequence

#### 1. Start the local program

Launch:

```text
FocusGardenLocalBackend.exe
```

Explain:

> This is the local component running on the user's computer. It includes the
> backend and ActivityWatch, so the user does not need a separate Python or
> ActivityWatch installation.

#### 2. Show health status

Open:

```text
http://127.0.0.1:8765/health
```

Explain:

> The service is listening only on this computer. The health endpoint confirms
> that the backend can reach ActivityWatch.

#### 3. Generate activity

Visit one productive page, one unrelated page, switch applications, and pause
briefly. Use distinct titles so the output is easy to read.

#### 4. Request the activity data

Run:

```powershell
$start = (Get-Date).ToUniversalTime().AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ssZ")
$end = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

Invoke-RestMethod `
    -Uri "http://127.0.0.1:8765/usage?start=$start&end=$end" |
    ConvertTo-Json -Depth 10
```

Explain:

> This is the request FocusGarden makes when a computer session ends. It asks the
> local backend for formatted activity during a particular period.

#### 5. Highlight the formatted response

Point out:

- `source`
- `start`
- `end`
- `duration_seconds`
- `site`
- `title`
- `search`
- `application`
- `idle`
- `total_active_seconds`
- `total_idle_seconds`

Explain:

> The backend converts ActivityWatch events into compact, predictable JSON
> that the LLM labeling pipeline consumes.

#### 6. Show privacy filtering

Point out that the normal response contains a hostname, title, and useful
search text rather than the complete original URL.

#### 7. Run a computer session on the FocusGarden page

Right-click the tray icon and choose **Open FocusGarden** (or browse to
`http://127.0.0.1:8765/`). Start a computer session, visit a productive page
and an unrelated page, then end the session. The program reads the session's
activity window (the same blocks `/activity` returns), labels them with the
same pipeline as `/label`, and the page displays the saved session's labels
and stats. Resolve an unclear block on the review screen to show the stats
and plant update.

#### 8. Demo a paper session and photo check

With the program running and a Claude API key set:

1. Start a paper session for a task, such as `finish chemistry problem set 4`.
2. Write the returned code word at the top of a page.
3. Write several notes related to the task.
4. Wait long enough to create a meaningful session duration.
5. Photograph the page so the code word and notes are readable.
6. Choose **Upload photo of my notes** and pick the JPEG, PNG, or WebP image.

The program checks it with the same logic as `POST /photo-check` (`task`,
`code_word`, `minutes`, `image_base64`, `media_type`). A successful check
resembles:

```json
{
  "verified": true,
  "credited_minutes": 10.0,
  "reason": "code word and task notes found"
}
```

Use a wrong code word, a page without notes, or an unrelated page to
demonstrate the rejection response. It should report `verified: false` and
award 0% of the session minutes. Only an ambiguous image with a matching code
word, visible notes, and task-related content can receive 50%. FocusGarden
allows two attempts: after the first failed attempt the page asks for another
photo and keeps the paper session active. Without a Claude API key, the check
counts as a failed attempt ("photo check unavailable"); calling `/photo-check`
directly returns HTTP 503.

For a direct PowerShell request, follow the base64 example in
[`README.md`](../README.md#use-paper-session-photo-checks). The automated
photo tests use fake readers and do not consume Claude API credits; a real
photo test requires a Claude API key.

#### 9. Show the interactive API documentation

Open:

```text
http://127.0.0.1:8765/docs
```

The FastAPI documentation lets you inspect and execute the page's `/api/`
routes and `/health`, `/activity`, `/usage`, `/label`, and `/photo-check`
requests interactively.

## What this demonstrates

This test/demo proves that the local backend can:

- Run on Windows as a packaged executable.
- Include and launch ActivityWatch.
- Collect browser, desktop, and idle activity.
- Accept a time-range request over localhost.
- Return structured, predictable JSON.
- Reduce unnecessary URL details.
- Provide data in the exact `ActivityWindow` format sessions are labeled from.
- Serve the FocusGarden page and run the full session flow (labeling, review,
  plant growth, paper photo checks) without a browser extension.
