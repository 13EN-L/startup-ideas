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

**Paper work counts too.** For offline study, the user starts a paper session and writes that session's code word at the top of their page. At the end, a photo of the page is checked by the LLM for the code word and task-related notes. Verified paper time gets full credit; unverified time gets partial credit.

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

```
Chrome extension (Windows / Mac)          Backend (FastAPI on Render)            LLM API
- task entry, session timer      ──────▶  - label activity blocks        ──────▶ labels / photo verdict
- tab + idle tracking                     - validate (schema, coverage,  ◀──────
- review screen, garden                     overrides, confidence)
- local storage (no accounts)    ◀──────  - retry on failure (max 2)
                                          - compute stats + sanity checks
```

**Privacy:** URLs are stripped to site + page title before leaving the browser. Paper photos are deleted after checking. Session history is stored only in the user's browser.

## Repository layout

```
extension/   Chrome extension (Manifest V3)
backend/     FastAPI service: LLM calls, validators, stats
eval/        Labeled test blocks and photos for measuring accuracy
docs/        Criteria checklist and design notes
```

## Run the local MVP on Windows

The MVP has two local pieces:

1. The **packaged local program** is a Windows executable containing the
   FastAPI service and ActivityWatch. It records browser, foreground-window,
   and idle activity on the user's computer.
2. The **Chrome extension** starts and ends sessions, asks the local program
   for activity, sends activity blocks to `/label`, and displays the result.

The local program and the extension communicate only through
`http://127.0.0.1:8765`. The local program also serves the LLM routes, so
there is no second local server on port 8000.

### Install and start the local program

For normal testing, download `FocusGardenLocalBackend-windows-x86_64.zip`
from a release artifact and:

1. Extract it, for example to `C:\FocusGarden`.
2. Open `C:\FocusGarden\FocusGardenLocalBackend`.
3. Run `FocusGardenLocalBackend.exe`.
4. Leave it running while the extension is in use.
5. Open `http://127.0.0.1:8765/health` and confirm `"reachable": true`.

The package includes ActivityWatch and starts it automatically. To start the
program when Windows logs in, create a shortcut to the executable in
`Windows + R` → `shell:startup`. See
[`backend/README.md`](backend/README.md) for source-mode setup, release
building, authentication, and troubleshooting.

### Configure and load the Chrome extension

The extension must point both `backendUrl` and `activityUrl` at
`http://127.0.0.1:8765`, and its `sharedSecret` must match the token used to
start the executable. For example:

```powershell
.\FocusGardenLocalBackend.exe --token "local-extension-token" `
  --anthropic-api-key "your-anthropic-key"
```

Never commit the Anthropic key. The extension sends `X-Flora-Secret` to
`/activity`, `/label`, and `/photo-check`.

This repository currently contains the extension background modules under
[`extension/background/`](extension/background/), but it does not currently
contain a Chrome `manifest.json` or a built popup/options UI. Therefore the
local program can be installed and tested now, while loading the complete
extension in `chrome://extensions` requires the extension manifest/UI task to
be present. When that task is available, use Chrome's **Developer mode** →
**Load unpacked** and select the directory containing `manifest.json`; then
configure the shared secret in the extension settings.

### Test the complete local integration

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
when ending a computer session. `/usage` remains available for diagnostics.

Run the automated backend and contract tests from the repository root:

```powershell
uv run --project backend --extra test --no-sync pytest backend\tests
```

For the full manual test and five-minute demo, see
[`backend/TESTING_AND_DEMO.md`](backend/TESTING_AND_DEMO.md). The demo should
show both sides: the extension starts a task session and ends it, while the
local program records the activity and returns blocks for labeling.

For Windows distribution, `backend/build_release.py` downloads and verifies
the pinned ActivityWatch v0.14.1 binary, freezes the Python service into
`FocusGardenLocalBackend.exe`, and creates a distributable zip. The build is
also available through
[`.github/workflows/build-windows-release.yml`](.github/workflows/build-windows-release.yml).

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
