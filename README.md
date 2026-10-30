# FocusGarden (working name)

**An AI productivity tracker and motivator for students.** You tell it what you want to get done, study as you normally would, and an LLM judges whether your activity actually matched that task. Verified on-task time grows plants in a virtual garden.

> Status: 6-week MVP in progress. One local Windows program (system tray + a page in your browser) + LLM.

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
2. **Work normally.** While the task is open, the local program records which tabs and apps are active, for how long, and when the user is idle.
3. **LLM judges the activity.** When the session ends, an LLM labels each block of activity as on-task, off-task, break or unclear, with a short reason. Productivity stats (on-task minutes, on-task %, longest focus streak) are computed by code from those labels.
4. **The garden grows.** Verified on-task time grows plants in a virtual garden. Different kinds of productivity grow different plants (for example, computer work and paper work grow different species), and more on-task time grows them further.

**Tasks and groups.** Everything is on one page. A task is named only when a session starts; starting another session with the same name adds to that task. Below the session, a **Tasks & groups** section lists every task and lets the user put it in groups (a task can be in several). Each task, group and the overall total shows the same productivity stats as a session result (on-task time and %, longest focus, the productive / distracting split, biggest distraction, time by site or app), combined over its sessions, plus **tracked** and **idle** time, for today and all time. Time ActivityWatch marks as away-from-keyboard is shown as idle, never as work.

**Paper work counts too.** For offline study, the user starts a paper session and writes that session's code word at the top of their page. At the end, a photo of the page is checked by the LLM for the code word and task-related notes. Verified paper time gets full credit; only an ambiguous but plausible photo can receive partial credit, while clear failures receive no credit.

**Nothing unvalidated reaches the garden.** Every LLM output is checked (schema, every block labeled exactly once, user allow/block lists, confidence thresholds, exact code-word match, stat sanity checks). On failure, the errors are sent back to the LLM for up to 2 retries; after that, uncertain blocks go to a review screen where the user decides.

### Core hypothesis
> Students will spend 20% less time on their computer between designating a task for themselves and completing that task when using FocusGarden.

### Scope (minimum feature set)

| Feature | Why it's in the MVP |
|---|---|
| Task entry + start/stop session | Needed to define what "productive" means for each session |
| Tab, app and idle tracking (local program with bundled ActivityWatch) | Most student coursework happens on the computer; one download, nothing to install in the browser |
| LLM labeling of activity vs. task | The core of the product: judging relevance to the task, which fixed blocklists can't do |
| Review screen for unclear blocks | Keeps the user in control when the LLM isn't sure, so wrong calls don't kill motivation |
| Paper session + code-word photo check | Paper study is real study; without it, the tracker would penalize it |
| Garden view | The motivation loop being tested by the hypothesis |
| Tasks & groups (per-task and per-group stats, idle vs work) | Measures total time across a set of tasks, the KPI in the validation plan |

**Deliberately out of scope:** Mac and Linux builds, phone tracking, AI-generated artwork, accounts and cloud sync.

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
- **Control group:** Uses a tracking-only version of FocusGarden (no LLM feedback, no garden), so both groups' time is measured the same way.
- **Measurement:** For each participant, we record total computer time between designating the tasks and completing all of them.

### Success metrics and threshold
- **KPI:** Average total computer time per participant between designating and completing the tasks.
- **Threshold:** The hypothesis is **supported** if the experimental group's average is at least 20% lower than the control group's. Otherwise it is **not supported** (we fail to reject the null hypothesis).
- **Limitation:** With 5 users per group, results are directional rather than statistically conclusive; a larger follow-up study would be needed to confirm them.

---

## Architecture

```
Browser tab: http://127.0.0.1:8765/        FocusGarden program (Windows tray)          LLM API
- task entry, session timer      ──────▶  - sessions, history, settings      ──────▶ labels / photo verdict
- review screen, garden                     (%USERPROFILE%\.focusgarden)      ◀──────
                                 ◀──────  - ActivityWatch: tab, app + idle tracking
                                          - validate (schema, coverage, overrides,
                                            confidence), retry on failure (max 2)
                                          - compute stats + plant growth
```

FocusGarden is **one local program**: a Windows executable containing a
FastAPI service and ActivityWatch. It runs in the system tray, listens on
`127.0.0.1:8765`, and:

- serves the FocusGarden page (right-click the tray icon → **Open
  FocusGarden**, or browse to `http://127.0.0.1:8765/`);
- starts and ends sessions, and keeps the running sessions, history and
  settings in `%USERPROFILE%\.focusgarden\sessions.json`;
- launches the bundled ActivityWatch recorder and reads privacy-filtered
  browser, foreground-window and idle activity;
- calls the LLM to label activity and check paper photos, then validates the
  output and computes stats and plant growth in code.

No browser extension is needed. The page is plain HTML and JavaScript; it
only renders and talks to the program through the same-origin `/api/` routes
documented in [`docs/contracts.md`](docs/contracts.md). The Claude API key
never reaches the page.

**Privacy:** URLs are stripped to site + page title before anything is sent to the LLM. Paper photos are deleted after checking. Session history is stored only on your computer.

## Repository layout

```
web/         The FocusGarden page (HTML/CSS/JS) and plant art, served by the program
backend/     The local program: FastAPI service, tray launcher, LLM calls, validators, stats
eval/        Labeled test blocks and photos for measuring accuracy
docs/        Data contracts and examples
```

`web/` was called `extension/` when FocusGarden was a Chrome extension; it is
now plain web files that the program serves (and bundles into the release).

Backend files:

| File | What it does |
|---|---|
| `backend/app/launcher.py` | Tray app (Open FocusGarden, API key, quit) and packaged entry point |
| `backend/app/main.py` | FastAPI routes: the page's `/api/`, the page itself, and the LLM/activity routes |
| `backend/app/sessions.py` | Start/end computer and paper sessions, block review, distracting sites |
| `backend/app/store.py` | Local JSON file with the running sessions, history and settings |
| `backend/app/plants.py` | Picks a plant and turns verified minutes into growth |
| `backend/app/tracker.py` | Tasks & groups: each session's task, groups, work/idle totals and combined stats |
| `backend/app/server.py` | Production entry point and runtime configuration |
| `backend/app/contracts.py` | Pydantic models for requests, responses, and LLM output |
| `backend/app/activitywatch.py` | Starts ActivityWatch and reads local events |
| `backend/app/formatting.py` | Privacy filtering and `/activity` conversion |
| `backend/app/labeling.py` | Rules, LLM retry loop, and confidence handling |
| `backend/app/stats.py` | On-task minutes, percentage, and longest streak, per session and combined |
| `backend/app/photo.py` | Code-word match and partial credit |
| `backend/app/claude.py` | The only code that calls Claude (`claude-opus-5-5` by default) |

Page files are in [`web/ui/`](web/ui/): `index.html`/`app.js`
(the main page), `tracker.js`/`trackerTotals.js` (the Tasks & groups section),
`settings.html`/`settings.js`, `api.js` (the only module that talks to the
program), `dom.js` (shared DOM and formatting helpers), `breakdown.js` (result
breakdowns, also combined over several sessions), `breakdownView.js` (the
elements that show them) and `plant.js` (GIF plant rendering). Plant GIFs and growth settings live in
[`web/plants/`](web/plants/); see the README there for adding a
plant.

---

## Run the local MVP on Windows

### 1. Install and start FocusGarden

Download `FocusGardenLocalBackend-windows-x86_64.zip` from a release, then:

1. Extract it, for example to `C:\FocusGarden`.
2. Open the extracted `FocusGardenLocalBackend` folder.
3. Double-click `FocusGardenLocalBackend.exe`.
4. Look for the FocusGarden leaf icon in the Windows notification area
   (system tray). The program runs in the background without an open terminal.
5. Right-click the tray icon, choose **Set Claude API key**, and enter your
   Claude API key (create one at https://platform.claude.com). The key is saved locally under
   `%USERPROFILE%\.focusgarden` and takes effect immediately; it is never sent
   to the page.

FocusGarden uses Claude through Anthropic's official Python SDK, with
`claude-opus-5-5` by default; set `CLAUDE_MODEL` (for example
`claude-sonnet-5-5` or `claude-haiku-5-5`) to trade some accuracy for lower
cost. Requests opt into Anthropic's server-side refusal fallback, so a request
a safety classifier declines is retried on Anthropic's recommended model. A
Google/Gemini key saved by earlier versions is no longer used.

The zip includes Python, the backend dependencies, ActivityWatch and the
FocusGarden page. No separate Python, ActivityWatch or browser extension
installation is needed. To run it at Windows login, create a shortcut to the
executable in the Startup folder (`Windows + R`, then `shell:startup`).

### 2. Open FocusGarden

Click the tray icon, or right-click it and choose **Open FocusGarden**. Your
default browser opens `http://127.0.0.1:8765/`. The top of the page has
the same screens the Chrome extension popup used to have: name a task and
start a computer or paper session, watch the timer and plant, see results,
review unclear blocks. Several tasks can run at once: each running session
gets its own card under **Running**, with its own timer, plant and **Done**
button, and the form stays available to start another. Below it, **Tasks & groups** lists your tasks with
their stats and lets you group them (see [Tasks and groups](#tasks-and-groups)).
Open **Settings** to edit distracting sites (**Check activity tracking** there confirms
ActivityWatch is running). You can close the tab while sessions run; the
program keeps them, and reopening the page shows them again.

The tray menu also has **Open health status** (`/health`) and **Quit
FocusGarden**.

For browser tabs to be recorded as individual **sites**, install
ActivityWatch's own browser watcher (`aw-watcher-web`) in your browser.
Without it, browser time is still recorded from the window title as an app
block (for example `Google Chrome` with the page title).

Advanced: `--token` protects the LLM and activity routes listed in the
[Local API reference](#local-api-reference) with a shared secret for direct
API callers. The FocusGarden page never needs it.

```powershell
.\FocusGardenLocalBackend.exe --token "local-api-token" `
  --anthropic-api-key "your-claude-api-key"
```

The tray's **Set Claude API key** menu is the recommended way to configure the
key; the `--anthropic-api-key` option remains available for automation and
source-mode testing. Never commit or publish the API key.

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

The FocusGarden page stops loading while the program is off; a session that
was running is kept and resumes when you start the executable again.
If you created a shortcut in `shell:startup`, Windows will start it again at
the next sign-in; remove that shortcut if you do not want automatic startup.

Only data that ActivityWatch has received before shutdown is available. If you
quit immediately while a new event is still being collected, allow a short
moment for the event to reach ActivityWatch before quitting.

Do not use Task Manager to stop only ActivityWatch: the backend may still be
running, and ending a session will then fail with a recorder-unavailable error.

---

## How a session works

- **Computer session:** when you end it, the program reads the session's
  activity from ActivityWatch, privacy-filters it into blocks, and labels them
  (the same pipeline as `/activity` + `/label`). If the LLM fails, the session
  keeps running so you can try again.
- **Paper session:** the page resizes your photo and sends it to the program,
  which checks it with the LLM and decides whether the time is verified (see
  [paper-session photo checks](#use-paper-session-photo-checks)).
- **Review:** unclear computer blocks can be resolved on the result screen.
  The program recomputes statistics and plant growth after your decision.
- **Garden:** the program picks a plant when a session starts and computes
  growth from verified minutes. Claude never controls plant growth.
- **Result stats:** the result screen shows a productive / distracting /
  break-or-unclear bar, time per site or app (top five plus Other), the
  biggest distraction, how many times you switched from on-task to off-task,
  and plant growth as a percentage with minutes left to full growth. These are
  computed on the page from the final labels, so review decisions update them.
- **Distracting sites:** sites listed under **Distracting sites** in Settings
  (Instagram, TikTok, Facebook, X/Twitter and Snapchat by default) are added to
  each computer session's blocklist, so they always count as off-task. Putting
  a site in a session's "Always on-task" list exempts it for that session.

## Tasks and groups

The **Tasks & groups** section, below the session on the same page, measures
total time and productivity across a set of tasks:

- **Tasks come from sessions only.** The task you type when starting a
  computer or paper session is the task. Starting another session with the
  same name (ignoring case) adds to that task. Different tasks can run at the
  same time, each with its own timer; the same task can't run twice at once.
  A task's timer runs only while one of its sessions does, and a session's
  **Done** button (on its card under **Running**) is the only way to stop it;
  there are no separate timers or task-level Done buttons.
- **Groups** are assigned here: each task has its groups as chips (× removes
  one) and an input to add it to a group, suggesting existing group names.
  A task can be in several groups. Group names match ignoring case, and the
  first spelling is shown. Tasks can also be deleted (deleting a task keeps
  its sessions in your history).
- **The same stats as a session result**, for every task, every group and all
  tasks together, today (sessions that started since local midnight) and all
  time: on-task time and %, longest focus streak and number of sessions.
  **Breakdown, all time** adds the productive / distracting / break-or-unclear
  bar, the biggest distraction with the number of off-task switches, and time
  by site or app. Minutes add up across sessions and the percentage is
  recomputed from them; the longest streak is the longest single one.
  Each session is judged against its own task only, so the same minutes can be
  on-task for one task and off-task for another. In group and overall stats,
  minutes when several sessions ran at once count once, as on-task if they
  were on-task for any of those tasks. A paper
  session's credited minutes count as on-task and the rest of it as unclear.
  Review decisions update these stats.
- **Idle vs work:** while a session's task runs, time ActivityWatch's AFK
  watcher marks as away is **idle**; the rest is **tracked** work. If
  ActivityWatch isn't reachable, the section says so and all tracked time
  shows as work until it is. Group and overall time is the union of their
  tasks' running time, so nothing is counted twice.

Totals and stats are computed by the program (`backend/app/tracker.py`,
`backend/app/stats.py`) from validated labels, never by the LLM. They refresh
every 30 seconds and whenever a session starts, ends or is reviewed; in
between, the page keeps running sessions' time counting.

`web/ui/api.js` is the only page module that makes requests. If two
FocusGarden tabs are open, saving a result in one refreshes the other.

## Local API reference

The packaged program listens only on `127.0.0.1` by default. The FocusGarden
page uses the `/api/` routes (formats in
[`docs/contracts.md`](docs/contracts.md)); they reject requests from other
websites (an `Origin` that isn't the program itself gets HTTP 403). The other
routes are for diagnostics and direct API use:

| Method and route | Authentication | Purpose |
|---|---|---|
| `GET /` | None | Redirects to the FocusGarden page at `/ui/` |
| `GET /api/active`, `GET /api/history` | Same origin | The running sessions (a list) and saved sessions |
| `POST /api/sessions`, `POST /api/sessions/{id}/end` | Same origin | Start / end (Done) a computer session; others keep running |
| `POST /api/paper-sessions`, `POST /api/paper-sessions/{id}/end` | Same origin | Start a paper session (returns `id` and `codeWord`) / submit its photo |
| `POST /api/sessions/{id}/blocks/{block_id}/review` | Same origin | Resolve an unclear block |
| `GET`/`PUT /api/settings` | Same origin | Distracting sites |
| `GET /api/tracker?since=...` | Same origin | Tasks & groups: time and productivity stats per task, group and overall (today from `since`, and all time) |
| `PATCH`/`DELETE /api/tracker/tasks/{id}` | Same origin | Change a task's groups or name / delete it (tasks are created by starting a session) |
| `GET /health` | None | Reports whether ActivityWatch is reachable and whether FocusGarden started it |
| `GET /claude-status` | `X-Flora-Secret` when a token is configured | Sends a minimal request to Claude to verify the saved key and model |
| `GET /activity?start=...&end=...` | `X-Flora-Secret` when a token is configured | Compact activity window (the blocks sessions are labeled from) |
| `GET /usage?start=...&end=...&include_raw=false` | `X-Flora-Secret` when a token is configured | Verbose diagnostic usage response |
| `POST /label` | `X-Flora-Secret` when a token is configured | Labels activity blocks with Claude |
| `POST /photo-check` | `X-Flora-Secret` when a token is configured | Checks a paper-study photo with Claude |

`start` and `end` must be timezone-aware ISO-8601 timestamps, and `end` must
be after `start`. Activity requests are limited to seven days by default.
When no shared secret is configured, the protected routes accept local
requests without a token. When a secret is configured, a missing or incorrect
`X-Flora-Secret` returns HTTP 401. A missing Claude API key causes `/label`
and `/photo-check` to return HTTP 503; a Claude authentication, model, quota,
or network failure on `/label` returns HTTP 502 with the provider's error
detail. Activity collection and `/health` do not require the Claude API.

### Verify the Claude key

After setting the key (the tray applies it immediately), run:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8765/claude-status" `
  -Method Get
```

The expected response is:

```json
{"status":"ok","model":"claude-opus-5-5"}
```

If the backend was started with `--token`, add
`-Headers @{ "X-Flora-Secret" = "local-api-token" }`. HTTP 503 means the
backend has no loaded key; HTTP 502 means Claude was called but rejected the
request or could not be reached, and the response detail explains why.

### Verify the activity contract

With the executable running:

```powershell
# Local recorder health
Invoke-RestMethod http://127.0.0.1:8765/health

# Compact activity contract (the header matters only if started with --token)
$headers = @{ "X-Flora-Secret" = "local-api-token" }
$start = (Get-Date).ToUniversalTime().AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ssZ")
$end = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8765/activity?start=$start&end=$end" `
  -Headers $headers | ConvertTo-Json -Depth 10
```

The second command should return an object with `start`, `end`, and `blocks`.
Each block has `kind` (`web`, `app`, or `idle`), whole-second duration, and
privacy-filtered site/title fields. Ending a computer session labels exactly
these blocks. `/usage` returns the more verbose diagnostic
format.

### Runtime configuration

For source mode, these environment variables provide the same configuration
as the packaged command-line options:

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | empty | Claude API key for labeling and photo checks (the tray's saved key is used when unset) |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Claude model ID (for example `claude-sonnet-5-5` or `claude-haiku-5-5` to lower cost) |
| `FOCUSGARDEN_EXTENSION_TOKEN` | empty | Shared secret expected in `X-Flora-Secret` (LLM/activity routes only) |
| `FOCUSGARDEN_STATE_DIRECTORY` | `%USERPROFILE%\.focusgarden` | Where the saved API key and `sessions.json` live |
| `FOCUSGARDEN_HOST` | `127.0.0.1` | Local API bind address |
| `FOCUSGARDEN_PORT` | `8765` | Local API port |
| `ACTIVITYWATCH_EXECUTABLE` | auto-detected in release | ActivityWatch executable path |
| `ACTIVITYWATCH_START_COMMAND` | empty | Alternative command for starting ActivityWatch |
| `ACTIVITYWATCH_URL` | `http://127.0.0.1:5600` | ActivityWatch API address |
| `ACTIVITYWATCH_TIMEOUT_SECONDS` | `5` | ActivityWatch request timeout |
| `FOCUSGARDEN_MAX_WINDOW_SECONDS` | `604800` | Maximum requested activity window (7 days) |

The packaged launcher also accepts `--token`, `--anthropic-api-key`, `--host`,
`--port`, and `--console`. Command-line values override the corresponding
launcher defaults. Keep API keys and shared secrets out of Git.

## Use paper-session photo checks

Paper sessions use the same program and Claude API key:

1. On the FocusGarden page, choose **Paper**, enter a task and start the
   session. The page shows a code word.
2. Write the code word at the top of the study page.
3. Study for the session.
4. Take a clear photo showing the code word and task-related notes.
5. Press **Done** on the session's card and choose the photo. The page shrinks
   the image and sends it to `POST /api/paper-sessions/{id}/end`; the program checks it with the same
   logic as:

```text
POST http://127.0.0.1:8765/photo-check
```

The backend sends the image and task to Claude. Claude returns
whether it saw the exact code word, whether notes are present, whether the
notes relate to the task, and a confidence score. The backend, not the model,
decides the credit:

| Result | Credit |
|---|---:|
| Code word matches, notes are present and task-related, confidence is at least 0.6 | 100% of session minutes |
| The code word matches, notes are present and task-related, but confidence is below 0.6 | 50% of session minutes |
| Wrong/missing code word, no notes, unrelated notes, model failure, or invalid output | 0% of session minutes |

FocusGarden permits two photo submissions per paper session. A failed first
attempt stays active and returns `attemptsRemaining` so the user can retake
the photo; the session is finalized after a successful verification or the
second failed attempt.

Photos are sent to Claude for checking and are not saved by the backend after
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
$headers = @{ "X-Flora-Secret" = "local-api-token" }  # only if started with --token
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

Without a Claude API key, the endpoint returns HTTP 503.

---

## Development

### Run tests

From the repository root:

```powershell
uv sync --project backend --extra test --inexact
uv run --project backend --extra test --no-sync pytest backend\tests
```

The automated tests use fake LLM readers, a fake ActivityWatch and a
temporary session store. They cover the session API (start/end, several sessions at once, paper photo
retries, review, plant growth, distracting sites, same-origin protection),
tasks and groups (tasks only from sessions, same-name sessions adding up,
group assignment, combined stats including reviews and paper credit, AFK idle
split, today vs all time),
that the page is served, LLM output validation, retries, exact code-word
matching, and credit rules. They do not call Claude or consume API credits.

The page's result breakdowns (time per site or app, the productive /
distracting split, top distraction), the same breakdowns combined over a
task's or group's sessions, and the live timer counting are tested with Node's built-in runner.
Node 18 or later is required; there are no dependencies to install:

```powershell
cd web
npm test
```

For the full manual test and five-minute demo, see
[`backend/TESTING_AND_DEMO.md`](backend/TESTING_AND_DEMO.md).

### Run the backend from source

Set the ActivityWatch executable and start the unified production app, then
open `http://127.0.0.1:8765/`:

```powershell
cd backend
$env:ACTIVITYWATCH_EXECUTABLE = "C:\Program Files\ActivityWatch\aw-qt.exe"
$env:ANTHROPIC_API_KEY = "your-claude-api-key"
uv run --no-sync uvicorn app.server:app --host 127.0.0.1 --port 8765
```

The page is served straight from `web/`, so edits to its HTML, CSS or
JavaScript show up on reload without restarting.

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
`FocusGardenLocalBackend.exe` (a windowed system-tray application) with the
FocusGarden page bundled in, and creates a distributable zip:

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
Python · FastAPI · Pydantic · Anthropic Python SDK (Claude) · ActivityWatch · pystray · plain HTML/CSS/JS page · pytest · Node test runner · PyInstaller · GitHub Actions · hosted LLM API with vision

## Timeline (6 weeks)

| Week | Goal |
|---|---|
| 1 | End-to-end skeleton: a session from the page is labeled by the local program and stats come back |
| 2 | Review screen, garden, prompt tuning against the eval set, paper sessions + photo check |
| 3 | Pilot and validation study, bug fixes, demo |

## Team
- *Name*: FocusGarden page
- *Name*: LLM backend
- *Name*: evaluation, paper sessions, deployment
