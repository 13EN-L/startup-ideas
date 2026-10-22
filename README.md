# FocusGarden (working name)

**An AI productivity tracker and motivator for students.** You tell it what you want to get done, study as you normally would, and an LLM judges whether your activity actually matched that task. Verified on-task time grows plants in a virtual garden.

> Status: 6-week MVP in progress. Browser extension (Chrome/Edge on Windows and Mac) + Python backend + LLM.

---

## 1. The Problem and the Market

### Pain point
Traditional productivity trackers either ask users to self-report how productive they were, or record how long each app or website was open. Neither checks whether the user was actually working on what they meant to do: an open Google Doc counts the same whether you're writing in it or staring at it, and a lecture video counts the same as any other YouTube video.

### Target user
Primarily (but not limited to) students who want to motivate themselves to get tasks done. There were about 18.4 million students enrolled in U.S. colleges in spring 2025 ([National Student Clearinghouse Research Center, via BestColleges](https://www.bestcolleges.com/research/college-enrollment-statistics/)), and much of their coursework happens in a browser.

### Current solutions and their shortcomings

| Product | What it does | Main shortcoming for students |
|---|---|---|
| [Flora](https://flora.appfinca.com/en/) | Focus timer on iOS, Android and a Chrome extension; a virtual tree dies if you leave the app | Only checks whether you left Flora, not whether your activity matches your task. Has no native Windows or Mac desktop app. |
| [TimeCamp](https://www.timecamp.com/digital-agencies) | Automatic time tracking that records app names, website addresses and document titles, matched to projects by keywords | Built for timesheets, billing and team reporting at freelancer-to-enterprise scale; app and URL tracking is a paid plan feature. |
| [MonitUp](https://alternativeto.net/software/monitup) | Employee performance tool that tracks which apps employees use and how they spend their time | Built for employers monitoring staff, not for students motivating themselves. |

**Our gap:** none of these judge whether what you're doing fits the specific task you set yourself, and none turn that judgment into motivation.

---

## 2. The MVP and Core Hypothesis

### Core value proposition
FocusGarden is both a productivity tracker and a motivator.

1. **Set a task.** The user enters what they want to do (for example "finish chem problem set 4").
2. **Work normally.** While the task is open, the extension records which tabs are active, for how long, and when the user is idle.
3. **LLM judges the activity.** When the session ends, an LLM labels each block of activity as on-task, off-task, break or unclear, with a short reason. Productivity stats (on-task minutes, on-task %, longest focus streak) are computed by code from those labels.
4. **The garden grows.** Verified on-task time grows plants in a virtual garden. Different kinds of productivity grow different plants (for example, computer work and paper work grow different species), and more on-task time grows them further.

**Paper work counts too.** For offline study, the user starts a paper session and writes that session's code word at the top of their page. At the end, a photo of the page is checked by the LLM for the code word and task-related notes. Verified paper time gets full credit; only an ambiguous but plausible photo can receive partial credit, while clear failures receive no credit.

**Nothing unvalidated reaches the garden.** Every LLM output is checked (schema, every block labeled exactly once, user allow/block lists, confidence thresholds, exact code-word match, stat sanity checks). On failure, the errors are sent back to the LLM for up to 2 retries; after that, uncertain blocks go to a review screen where the user decides.

### Core hypothesis
> Students will spend 20% less time on their computer between designating a task for themselves and completing that task when using FocusGarden.

### Scope (minimum feature set)

| Feature | Why it's in the MVP |
|---|---|
| Task entry + start/stop session | Needed to define what "productive" means for each session |
| Tab and idle tracking (browser extension) | Most student coursework happens in the browser; an extension works on Windows and Mac with no installer |
| LLM labeling of activity vs. task | The core of the product: judging relevance to the task, which fixed blocklists can't do |
| Review screen for unclear blocks | Keeps the user in control when the LLM isn't sure, so wrong calls don't kill motivation |
| Paper session + code-word photo check | Paper study is real study; without it, the tracker would penalize it |
| Garden view | The motivation loop being tested by the hypothesis |

**Deliberately out of scope:** native desktop apps (non-browser apps aren't tracked yet), phone tracking, AI-generated artwork, accounts and cloud sync.

### Demo
*Mockups / demo video: coming soon.*

Planned walkthrough:
1. Enter a task and start a session.
2. Work in a few tabs, including one off-task tab.
3. End the session and see each block labeled with a reason.
4. Resolve one "unclear" block on the review screen.
5. Run a paper session and submit a photo with the code word.
6. Watch the garden grow from the verified stats.

---

## 3. Validation Strategy and Metrics

### Validation plan
- **Participants:** 10 students recruited from our classes and study groups, split into two groups of 5.
- **Task:** Both groups are given the same set of tasks to complete.
- **Experimental group:** Uses the full FocusGarden MVP.
- **Control group:** Uses a tracking-only version of the extension (no LLM feedback, no garden), so both groups' time is measured the same way.
- **Measurement:** For each participant, we record total computer time between designating the tasks and completing all of them.

### Success metrics and threshold
- **KPI:** Average total computer time per participant between designating and completing the tasks.
- **Threshold:** The hypothesis is **supported** if the experimental group's average is at least 20% lower than the control group's. Otherwise it is **not supported** (we fail to reject the null hypothesis).
- **Limitation:** With 5 users per group, results are directional rather than statistically conclusive; a larger follow-up study would be needed to confirm them.

---

## Architecture
## Architecture

```
Chrome extension (Windows / Mac)          Backend (FastAPI on Windows)            LLM API
- task entry, session timer      ──────▶  - label activity blocks        ──────▶ labels / photo verdict
- tab + idle tracking                     - validate (schema, coverage,  ◀──────
- review screen, garden                     overrides, confidence)
- local storage (no accounts)    ◀──────  - retry on failure (max 2)
                                          - compute stats + sanity checks
```

The MVP has two local pieces:

1. The **packaged local program** is a Windows executable containing the
   FastAPI service and ActivityWatch. It runs one FastAPI application on
   `127.0.0.1:8765`, launches the bundled ActivityWatch recorder, returns
   privacy-filtered browser, foreground-window and idle activity, and hosts
   the LLM labeling and paper-photo routes. There is no separate port-8000
   service.
2. The **Chrome extension** owns the popup, settings page, service worker,
   browser-local session history, and plant display. It starts and ends
   sessions, asks the local program for activity, sends activity blocks to
   `/label`, and displays the result. It does not contain a Google API key
   and does not call Gemini directly.

The two communicate only through `http://127.0.0.1:8765`. The extension-side
request and response formats are documented in
[`docs/contracts.md`](docs/contracts.md).

**Privacy:** URLs are stripped to site + page title before leaving the browser. Paper photos are deleted after checking. Session history is stored only in the user's browser.

## Repository layout

```
extension/   Chrome extension (Manifest V3)
backend/     FastAPI service: LLM calls, validators, stats
eval/        Labeled test blocks and photos for measuring accuracy
docs/        Criteria checklist and design notes
```

Backend files:

| File | What it does |
|---|---|
| `backend/app/contracts.py` | Pydantic models for requests, responses, and LLM output |
| `backend/app/main.py` | Unified FastAPI routes and shared-secret check |
| `backend/app/server.py` | Production entry point and runtime configuration |
| `backend/app/activitywatch.py` | Starts ActivityWatch and reads local events |
| `backend/app/formatting.py` | Privacy filtering and `/activity` conversion |
| `backend/app/labeling.py` | Rules, LLM retry loop, and confidence handling |
| `backend/app/stats.py` | On-task minutes, percentage, and longest streak |
| `backend/app/photo.py` | Code-word match and partial credit |
| `backend/app/gemini.py` | The only code that calls Gemini 3.8 Flash |
| `extension/background/` | Chrome service-worker clients for local activity and LLM routes |

Plant GIFs and growth settings live in [`extension/plants/`](extension/plants/);
see the README there for adding a plant.

---

## Run the local MVP on Windows

### 1. Install and start the local program

Download `FocusGardenLocalBackend-windows-x86_64.zip` from a release, then:

1. Extract it, for example to `C:\FocusGarden`.
2. Open the extracted `FocusGardenLocalBackend` folder.
3. Double-click `FocusGardenLocalBackend.exe`.
4. Look for the FocusGarden leaf icon in the Windows notification area
   (system tray). The program runs in the background without an open terminal.
5. Open `http://127.0.0.1:8765/health` and confirm `reachable` is `true`.
6. Right-click the tray icon, choose **Set Google API key**, and enter your
   Google AI Studio key. The key is saved locally under
   `%USERPROFILE%\.focusgarden` and takes effect immediately; it is never sent
   to the browser extension.

The zip includes Python, the backend dependencies, and ActivityWatch. No
separate Python or ActivityWatch installation is needed. To run it at Windows
login, create a shortcut to the executable in the Startup folder
(`Windows + R`, then `shell:startup`). Right-click the tray icon to open the
health page or quit the backend.

To protect extension-facing routes with a shared secret, start the program
with a token:

```powershell
.\FocusGardenLocalBackend.exe --token "local-extension-token" `
  --google-api-key "your-google-api-key"
```

The extension must be configured with the same token; it sends it as
`X-Flora-Secret` to `/activity`, `/label`, and `/photo-check`. The tray's
**Set Google API key** menu is the recommended way to configure the key; the
`--google-api-key` option remains available for automation and source-mode
testing. Never commit or publish the Google API key.

### 2. Load the Chrome extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose the [`extension/`](extension/) directory.
4. Open the extension's **Settings** page and confirm:
   - Backend address: `http://127.0.0.1:8765` (used for both `backendUrl` and
     `activityUrl`)
   - Shared secret: blank unless the backend was started with `--token`, in
     which case it must match that token
5. Click **Test connection**. The backend must be running and ActivityWatch
   must be reachable.

### 3. Turn FocusGarden off

To stop FocusGarden for the current Windows session:

1. Find the green FocusGarden leaf in the notification area. If it is hidden,
   click the small `^` arrow near the clock.
2. Right-click the leaf icon.
3. Select **Quit FocusGarden**.

This stops the local API and the entire ActivityWatch process tree launched by
FocusGarden, including `aw-server` and watcher processes. It does not
uninstall anything or delete ActivityWatch's locally stored history.
ActivityWatch writes that history to its Windows user-data directory,
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

---

## How a session works

- **Computer session:** the service worker requests `/activity`, then sends
  the privacy-filtered blocks to `/label` when the session ends.
- **Paper session:** the service worker sends the resized photo to
  `/photo-check`; the backend decides whether the time is verified (see
  [paper-session photo checks](#use-paper-session-photo-checks)).
- **Review:** unclear computer blocks can be resolved in the popup. The
  service worker recomputes statistics locally after the user's decision.
- **Garden:** the extension selects a plant and computes growth from verified
  minutes. Gemini never controls plant growth.
- **Result stats:** the result screen shows a productive / distracting /
  break-or-unclear bar, time per site or app (top five plus Other), the
  biggest distraction, how many times you switched from on-task to off-task,
  and plant growth as a percentage with minutes left to full growth. These are
  computed in the extension from the final labels, so review decisions update
  them.
- **Distracting sites:** sites listed under **Distracting sites** in Settings
  (Instagram, TikTok, Facebook, X/Twitter and Snapchat by default) are added to
  each computer session's blocklist, so they always count as off-task. Putting
  a site in a session's "Always on-task" list exempts it for that session.

The service worker is the only extension module that talks to the backend.
The popup communicates with it using `chrome.runtime.sendMessage`; UI code
does not make backend requests directly.

## Local API reference

The packaged program listens only on `127.0.0.1` by default, so these routes
are intended for the local extension and local testing:

| Method and route | Authentication | Purpose |
|---|---|---|
| `GET /health` | None | Reports whether ActivityWatch is reachable and whether FocusGarden started it |
| `GET /gemini-status` | `X-Flora-Secret` when a token is configured | Sends a minimal request to Gemini to verify the saved key and model |
| `GET /activity?start=...&end=...` | `X-Flora-Secret` when a token is configured | Canonical extension activity window |
| `GET /usage?start=...&end=...&include_raw=false` | `X-Flora-Secret` when a token is configured | Verbose diagnostic usage response |
| `POST /label` | `X-Flora-Secret` when a token is configured | Labels activity blocks with Gemini |
| `POST /photo-check` | `X-Flora-Secret` when a token is configured | Checks a paper-study photo with Gemini |

`start` and `end` must be timezone-aware ISO-8601 timestamps, and `end` must
be after `start`. Activity requests are limited to seven days by default.
When no shared secret is configured, the protected routes accept local
requests without a token. When a secret is configured, a missing or incorrect
`X-Flora-Secret` returns HTTP 401. A missing Google API key causes `/label`
and `/photo-check` to return HTTP 503; a Gemini authentication, model, quota,
or network failure on `/label` returns HTTP 502 with the provider's error
detail. Activity collection and `/health` do not require the Google API.

### Verify the Gemini key

After restarting the local program, run:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8765/gemini-status" `
  -Method Get
```

The expected response is:

```json
{"status":"ok","model":"gemini-3.8-flash"}
```

If the backend was started with `--token`, add
`-Headers @{ "X-Flora-Secret" = "your-extension-token" }`. HTTP 503 means the
backend has no loaded key; HTTP 502 means Gemini was called but rejected the
request or could not be reached, and the response detail explains why.

### Verify the activity contract

With the executable running:

```powershell
# Local recorder health
Invoke-RestMethod http://127.0.0.1:8765/health

# Extension-facing activity contract
$headers = @{ "X-Flora-Secret" = "local-extension-token" }
$start = (Get-Date).ToUniversalTime().AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ssZ")
$end = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8765/activity?start=$start&end=$end" `
  -Headers $headers | ConvertTo-Json -Depth 10
```

The second command should return an object with `start`, `end`, and `blocks`.
Each block has `kind` (`web`, `app`, or `idle`), whole-second duration, and
privacy-filtered site/title fields. The extension uses this exact response
when ending a computer session. `/usage` returns the more verbose diagnostic
format.

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

1. Start a paper session with a task. The extension sends
   `{"type": "startPaperSession", "task": "finish chemistry problem set 4"}`
   to its service worker.
2. Write the returned `codeWord` at the top of the study page.
3. Study for the session.
4. Take a clear photo showing the code word and task-related notes.
5. End the paper session and submit the photo. The extension converts the
   image to base64 and sends `endPaperSession` with `imageBase64` and its
   `mediaType` (`image/jpeg`, `image/png`, or `image/webp`).

The service worker sends this request to:

```text
POST http://127.0.0.1:8765/photo-check
```

The backend sends the image and task to Gemini 3.8 Flash. Gemini returns
whether it saw the exact code word, whether notes are present, whether the
notes relate to the task, and a confidence score. The backend, not the model,
decides the credit:

| Result | Credit |
|---|---:|
| Code word matches, notes are present and task-related, confidence is at least 0.6 | 100% of session minutes |
| The code word matches, notes are present and task-related, but confidence is below 0.6 | 50% of session minutes |
| Wrong/missing code word, no notes, unrelated notes, model failure, or invalid output | 0% of session minutes |

The extension permits two photo submissions per paper session. A failed first
attempt stays active and returns `attemptsRemaining` so the user can retake
the photo; the session is finalized after a successful verification or the
second failed attempt.

Photos are sent to Gemini for checking and are not saved by the backend after
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

Without a Google API key, the endpoint returns HTTP 503.

---

## Development

### Run tests

From the repository root:

```powershell
uv sync --project backend --extra test --inexact
uv run --project backend --extra test --no-sync pytest backend\tests
```

The automated tests use fake photo readers to verify validation, retries,
exact code-word matching, zero credit for clear failures, and limited partial
credit; they do not call Gemini or consume API credits.

The extension's stats (time per site or app, the productive / distracting
split, top distraction, plant growth) and the distracting-site list are
tested with Node's built-in runner. Node 18 or later is required; there are no
dependencies to install:

```powershell
cd extension
npm test
```

For the full manual test and five-minute demo, see
[`backend/TESTING_AND_DEMO.md`](backend/TESTING_AND_DEMO.md). The demo should
show both sides: the extension starts a task session and ends it, while the
local program records the activity and returns blocks for labeling.

### Run the backend from source

Set the ActivityWatch executable and start the unified production app:

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
Use `--console` if you want visible Uvicorn logs instead of the tray:

```powershell
uv run --no-sync python -m app.launcher --console --port 8765
```

Press `Ctrl+C` in this console to stop the source-mode backend. In the normal
packaged release, use the tray menu instead.

### Build a Windows release

After changing backend code, rebuild the packaged application from the
repository root. The release builder downloads and verifies the pinned
ActivityWatch v0.14.1 binary, freezes the Python service into
`FocusGardenLocalBackend.exe` (a windowed system-tray application), and
creates a distributable zip containing both programs:

```powershell
uv sync --project backend --extra build --inexact
uv run --project backend --extra build --no-sync python backend\build_release.py
```

The result is `backend\FocusGardenLocalBackend-windows-x86_64.zip`. The
intermediate release folder is placed in the Windows temporary directory by
default so OneDrive file locks do not interfere with rebuilding. Set
`$env:FOCUSGARDEN_RELEASE_DIR` if you need to keep that intermediate folder
somewhere else.

The build is also available through
[`.github/workflows/build-windows-release.yml`](.github/workflows/build-windows-release.yml).

### Accuracy evaluation

This command uses API credits:

```powershell
cd backend
uv run --no-sync python ..\eval\run_eval.py
```

---

## Tech stack
Chrome Extension (Manifest V3) · Python · FastAPI · Pydantic · pytest · GitHub Actions · hosted LLM API with vision

## Timeline (6 weeks)

| Week | Goal |
|---|---|
| 1 | End-to-end skeleton: a session from the extension is labeled by the deployed backend and stats come back |
| 2 | Review screen, garden, prompt tuning against the eval set, paper sessions + photo check |
| 3 | Pilot and validation study, bug fixes, demo |

## Team
- *Name*: extension
- *Name*: LLM backend
- *Name*: evaluation, paper sessions, deployment
