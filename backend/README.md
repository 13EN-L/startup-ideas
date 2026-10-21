# FocusGarden local usage backend

This Windows-local Python service bridges the Chrome extension to
[ActivityWatch](https://activitywatch.net/). ActivityWatch records browser,
foreground-window, and idle events locally. The service launches the managed
ActivityWatch process when it is not already available, and exposes a compact,
privacy-filtered time-range API.

## Simplest option: use the packaged Windows release

The packaged release includes the backend, Python, all required packages, and
ActivityWatch. A user does not need to install Python or ActivityWatch.

1. Download `FocusGardenLocalBackend-windows-x86_64.zip`.
2. Extract the zip to a folder, such as `C:\FocusGarden`.
3. Open the extracted `FocusGardenLocalBackend` folder.
4. Double-click `FocusGardenLocalBackend.exe`.
5. Leave that window running while using the computer.

The Chrome extension can then request data from:

```text
http://127.0.0.1:8765
```

To start the backend automatically when Windows starts, create a shortcut to
`FocusGardenLocalBackend.exe` in the Startup folder:

1. Press `Windows + R`.
2. Enter `shell:startup` and press Enter.
3. Copy a shortcut to `FocusGardenLocalBackend.exe` into that folder.

The bundled ActivityWatch process starts automatically when the backend receives
its first usage request.

## For developers: build the packaged release

The repository does not commit ActivityWatch's large third-party binary. The
release builder downloads the pinned
[ActivityWatch v0.14.1 Windows release](https://github.com/ActivityWatch/activitywatch/releases/tag/v0.14.1),
selects the Windows zip asset, verifies its SHA-256 digest against GitHub's
release metadata, and copies it into the frozen backend distribution.

Install the build dependency and run:

```powershell
cd "C:\path\to\startup-ideas"
uv sync --project backend --extra build --inexact
uv run --project backend --extra build python backend\build_release.py
```

The builder produces:

```text
backend\FocusGardenLocalBackend-windows-x86_64.zip
```

That zip is the file to distribute to users. The extracted application is an
`onedir` release because ActivityWatch contains multiple binaries and
resources.

The repository also includes a GitHub Actions workflow at
`.github/workflows/build-windows-release.yml`. It builds the same zip on
manual dispatch or when a `v*` tag is pushed, and publishes it as a workflow
artifact.

The executable also supports optional command-line arguments:

```powershell
.\FocusGardenLocalBackend.exe --port 8765
.\FocusGardenLocalBackend.exe --token "local-extension-token"
```

ActivityWatch is the persistence layer; this service does not copy events into
a second database. The bundled ActivityWatch process is started on the first
usage request when it is not already running.

## Development mode without packaging

To run directly from source, install Python 3.11 or newer and use:

```powershell
cd "C:\path\to\startup-ideas\backend"
uv sync --extra test --inexact
$env:ACTIVITYWATCH_EXECUTABLE = "C:\Program Files\ActivityWatch\aw-qt.exe"
$env:FOCUSGARDEN_EXTENSION_TOKEN = "local-extension-token"
uv run uvicorn app.main:app --host 127.0.0.1 --port 8765
```

If the environment is already installed and Windows reports that a
`focusgarden_local_backend-*.dist-info` directory is locked, run commands
without synchronizing first:

```powershell
uv run --no-sync --project backend --extra test pytest backend\tests
```

## Extension API

All timestamps must include a timezone. The response is stable JSON and strips
full URLs down to a hostname, title, and (when present) common search-query
parameters.

```http
GET http://127.0.0.1:8765/usage?start=2026-10-21T12:00:00Z&end=2026-10-21T13:00:00Z
Authorization: Bearer use-a-random-local-token
```

Example response:

```json
{
  "start": "2026-10-21T12:00:00Z",
  "end": "2026-10-21T13:00:00Z",
  "event_count": 1,
  "total_active_seconds": 60.0,
  "total_idle_seconds": 0.0,
  "events": [
    {
      "source": "browser",
      "start": "2026-10-21T12:00:00Z",
      "end": "2026-10-21T12:01:00Z",
      "duration_seconds": 60.0,
      "site": "example.com",
      "title": "Example",
      "search": null,
      "application": null,
      "idle": false
    }
  ],
  "raw_events": null
}
```

`GET /health` reports whether the ActivityWatch API is reachable. Add
`include_raw=true` to `/usage` only for local diagnostics; raw events may
contain more identifying data and should not be sent to an LLM by default.
