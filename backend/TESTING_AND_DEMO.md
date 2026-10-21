# Local Backend Testing and Demo Guide

This guide explains how to test and demonstrate the FocusGarden local backend
on Windows. The backend connects the Chrome extension to ActivityWatch,
collects local browser/desktop/idle activity, and returns formatted JSON for a
requested time range.

## What this guide tests

The complete flow is:

```text
Computer activity
    -> ActivityWatch
    -> FocusGarden local backend
    -> Formatted JSON over localhost
    -> Chrome extension or future LLM pipeline
```

The guide covers:

- Installing and launching the packaged backend
- Confirming ActivityWatch is available
- Running the automated backend tests
- Requesting real usage data
- Checking privacy filtering and error handling
- Demonstrating the component to other people

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

Leave the console window open while testing. The backend listens on:

```text
http://127.0.0.1:8765
```

The bundled ActivityWatch process is launched automatically when the backend
receives its first usage request.

To test command-line startup instead, open PowerShell in the application
folder and run:

```powershell
.\FocusGardenLocalBackend.exe --help
.\FocusGardenLocalBackend.exe --port 8765
```

The `--help` command should list `--host`, `--port`, and `--token`.

### 3. Optional: configure extension authentication

For a local demo without authentication, start the executable normally.

To require a bearer token, start it with:

```powershell
.\FocusGardenLocalBackend.exe --token "local-extension-token"
```

The Chrome extension must then send:

```http
Authorization: Bearer local-extension-token
```

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
$env:FOCUSGARDEN_EXTENSION_TOKEN = "local-extension-token"
uv run uvicorn app.main:app --host 127.0.0.1 --port 8765
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
7 passed
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
`managed_process_running: false` is normal if ActivityWatch was already
running before the backend started.

If authentication is enabled:

```powershell
$headers = @{
    Authorization = "Bearer local-extension-token"
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
    Authorization = "Bearer local-extension-token"
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
`Authorization` header.

Expected result: HTTP 401.

### ActivityWatch unavailable

Stop ActivityWatch and request `/usage`.

Expected result: HTTP 503 rather than a successful response containing
fabricated or empty usage data.

## Five-minute demo script

### Before the demo

1. Extract the packaged release.
2. Start `FocusGardenLocalBackend.exe`.
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

> This is the kind of request the Chrome extension will make. It asks the
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
> that the extension or later LLM pipeline can consume.

#### 6. Show privacy filtering

Point out that the normal response contains a hostname, title, and useful
search text rather than the complete original URL.

#### 7. Show the interactive API documentation

Open:

```text
http://127.0.0.1:8765/docs
```

The FastAPI documentation lets you inspect and execute `/health` and `/usage`
requests interactively.

## What this demonstrates

This test/demo proves that the local backend can:

- Run on Windows as a packaged executable.
- Include and launch ActivityWatch.
- Collect browser, desktop, and idle activity.
- Accept a time-range request over localhost.
- Return structured, predictable JSON.
- Reduce unnecessary URL details.
- Provide data in a format suitable for the Chrome extension.

It does not yet demonstrate the separate Chrome extension UI, LLM
productivity labeling, review screen, garden updates, or paper-session
behavior. Those belong to other MVP components.
