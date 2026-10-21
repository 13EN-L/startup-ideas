# FocusGarden local usage backend

This Windows-local Python service bridges the Chrome extension to
[ActivityWatch](https://activitywatch.net/). ActivityWatch records browser,
foreground-window, and idle events locally. The service launches the managed
ActivityWatch process when it is not already available, and exposes a compact,
privacy-filtered time-range API.

## Run on Windows

Install Python 3.11 or newer, install the dependencies, and configure the
ActivityWatch executable distributed with your local build:

```powershell
py -m pip install -e ".[test]"
$env:ACTIVITYWATCH_EXECUTABLE = "C:\Program Files\ActivityWatch\activitywatch.exe"
$env:FOCUSGARDEN_EXTENSION_TOKEN = "use-a-random-local-token"
py -m uvicorn app.main:app --host 127.0.0.1 --port 8765
```

For a packaged release, place the ActivityWatch executable beside the backend
and set `ACTIVITYWATCH_EXECUTABLE` to that path. Alternatively,
`ACTIVITYWATCH_START_COMMAND` can contain a quoted command with arguments.
ActivityWatch is the persistence layer; this service does not copy events into
a second database.

To run after reboot without changing system settings automatically, create a
shortcut to the command above in `shell:startup`, or create an equivalent
Task Scheduler task with “Run only when user is logged on”. The service must
start after ActivityWatch's bundled watchers are available; it will also
attempt to launch the configured ActivityWatch process itself.

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
