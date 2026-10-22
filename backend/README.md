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
4. Leave it running while Chrome sessions are active.
5. Open `http://127.0.0.1:8765/health` and confirm `reachable` is `true`.

The zip includes Python, the backend dependencies, and ActivityWatch. No
separate Python or ActivityWatch installation is needed. To run it at Windows
login, create a shortcut to the executable in the Startup folder
(`Windows + R`, then `shell:startup`).

To protect extension-facing routes with a shared secret:

```powershell
.\FocusGardenLocalBackend.exe --token "local-extension-token" `
  --anthropic-api-key "your-anthropic-key"
```

Configure the extension's `sharedSecret` with the same token. The extension
sends it as `X-Flora-Secret`. Do not commit or publish the Anthropic key.

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
$env:ANTHROPIC_API_KEY = "your-anthropic-key"
uv run --no-sync uvicorn app.server:app --host 127.0.0.1 --port 8765
```

If Windows reports that a `focusgarden_local_backend-*.dist-info` directory is
locked, do not delete it while it is in use. Run with `--no-sync`, or close
Python/VS Code processes that use the virtual environment before synchronizing.

## Build a Windows release

The release builder downloads and verifies ActivityWatch v0.14.1, freezes the
Python service, and creates a zip containing both programs:

```powershell
uv sync --project backend --extra build --inexact
uv run --project backend --extra build --no-sync python backend\build_release.py
```

The result is `backend\FocusGardenLocalBackend-windows-x86_64.zip`. On
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
| `app/claude.py` | The only code that calls Claude |
| `../extension/background/` | Chrome service-worker clients for local activity and LLM routes |
