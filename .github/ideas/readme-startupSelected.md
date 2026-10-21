# Startup 2: Flora (3-week MVP: AI focus check for browser and paper study)

## Criteria Checklist

### 1. Solves one problem extremely well
- The single problem: Students can't tell how much of a study session actually went to the task they meant to do, because focus apps only check whether you left the app. Our MVP judges each study session's browser activity and paper notes against the declared task and grows a garden only from on-task time.

### 2. Target customers / direct access
- Who they are: College students who study in the browser (Google Docs, Canvas, Overleaf, lecture videos) and on paper, and want honest feedback on their focus. Flora reports a 4.7+ rating from 2M+ users, which shows demand for focus tools.
- How you know them or can reach them (job, community, existing contacts, forums): We are college students ourselves, so our pilot users are our classmates, study groups and friends, who can install the extension in minutes.

### 3. Familiar infrastructure
- What infrastructure is familiar: A Chrome extension (Manifest V3, using the standard tabs and idle APIs) that works in Chrome and Edge on Windows and Mac with no installer, a stateless Python (FastAPI) backend and a hosted LLM API with vision support. Sessions and the garden are stored locally in the extension, so there is no database or login.

### 4. Reimagines the problem space
- Status quo: Flora grows a tree if you stay in the app and kills it if you leave, so it never checks whether your activity matches your task: study videos count as failure, idle time in the app counts as focus, and paper notes can't be credited.
- Reimagined approach: You declare a task and study normally; at the end, the LLM labels your browser activity against the task, and paper sessions are verified by a photo of your notes showing that session's code word. The garden grows from on-task minutes, with partial credit instead of all-or-nothing.

### 5. LLM is core (not a sidebar chatbot)
- What the LLM generates/transforms that is the product itself: It turns a session's tab activity (page title, site, duration) and the declared task into labeled blocks (on-task, off-task, break or unclear, with a reason), and turns a paper-session photo into a verdict on whether it shows the code word and notes related to the task.
- Why the product can't exist without it: Deciding whether an arbitrary page title or a handwritten page fits an arbitrary user-written task cannot be done with fixed rules or blocklists.

### 6. Validation guardrail
- Artifact(s) the LLM produces: A JSON list of block labels (block ID, label, confidence, reason) and a JSON photo verdict (transcribed code word, notes present, matches task, confidence). All stats (on-task minutes, on-task %, longest streak) are computed by code from the validated labels, never by the LLM.
- Validator(s): Pydantic schema checks, a coverage check that every block is labeled exactly once, user allowlist/blocklist overrides, low-confidence labels sent to the review screen, an exact match between the transcribed and issued code word, and stat invariant tests (minutes add up to session length, percentages 0-100).
- Rule: nothing reaches the user unless it passes. Flow: session ends → blocks → strip URLs to site + title → LLM → schema + coverage check → overrides + confidence check → code computes stats → invariant check → PASS: grow garden | FAIL: errors → step 7. Paper: photo → LLM → schema check → code-word match → PASS: on-task credit | FAIL: self-reported partial credit.

### 7. Self-correction loop
- On failure, the validator's error messages are sent back to the LLM with the original prompt
- Max retries: 2, then fail safely. Unlabeled blocks become "unclear" for the user to review, and a failed photo check leaves the paper session at self-reported partial credit, so unvalidated output never grows the garden.

### 8. Deployability
- Deployment target: One Dockerized FastAPI service on Render that holds the LLM key, with a shared-secret header and rate limit to prevent abuse. The extension is shared with pilot users as an unpacked zip, which skips Chrome Web Store review.
- IaC / CI/CD: A Dockerfile and render.yaml as infrastructure code, and GitHub Actions running pytest plus a 50-block labeled eval set, then triggering the Render deploy on merge to main.
- Confirmation you can deploy it end to end: Not yet confirmed; by the end of week 1, run one real session from the extension on a Windows and a Mac laptop through the deployed backend and see validated labels and stats come back.
