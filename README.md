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

### Local computer-usage backend

The repository also includes a Windows-local bridge in [`backend/`](backend/).
It manages a configured ActivityWatch process, reads browser, foreground-window,
and idle events, and exposes privacy-filtered time-range data to the Chrome
extension at `http://127.0.0.1:8765/usage`. See
[`backend/README.md`](backend/README.md) for installation, optional bearer
authentication, Windows startup instructions, and the request/response schema.
ActivityWatch remains the local source of truth; the bridge does not upload
usage data or persist a second copy.

For Windows distribution, `backend/build_release.py` downloads and verifies
the pinned ActivityWatch v0.14.1 binary, freezes the Python service into
`FocusGardenLocalBackend.exe`, and creates a distributable zip. The build is
also available through
[`.github/workflows/build-windows-release.yml`](.github/workflows/build-windows-release.yml).

## Tech stack
Chrome Extension (Manifest V3) · Python · FastAPI · Pydantic · pytest · Docker · Render · GitHub Actions · hosted LLM API with vision

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
