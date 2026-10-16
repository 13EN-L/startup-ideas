# Startup 2: Flora (AI focus judge + generated artwork edition)

## Criteria Checklist

### 1. Solves one problem extremely well
- The single problem: People struggle to stay focused on what matters because focus apps treat all time away from the app as failure, with no sense of what the user is actually trying to do. Our version judges whether current activity fits the user's declared task and rewards focus with a unique piece of generated artwork.

### 2. Target customers / direct access
- Who they are: Students and young professionals who want to cut distraction and build focus habits, on both phone and computer (Flora's reviews cite MCAT prep, A Levels and university exams). Flora reports a 4.7+ rating from 2M+ users.
- How you know them or can reach them (job, community, existing contacts, forums): Reach them through campus and study-group communities, study-focused subreddits and Discord servers, and friend groups, since Flora's core loop is social. Add your own school, job and contact network here.

### 3. Familiar infrastructure
- What infrastructure is familiar: A Chrome extension (Flora already ships one) that runs on Windows and Mac, a small API backend, and a hosted LLM API. A later Electron desktop app with an active-window library can extend detection beyond the browser on both systems.

### 4. Reimagines the problem space
- Status quo: Flora grows a tree from a fixed library and kills it if you leave the app for social media or games. It never checks whether your activity matches your task, so study videos can count as failure and idle time in the app counts as focus.
- Reimagined approach: An LLM judges each activity against the declared task (on-task, off-task or ask the user), and focused time builds a unique piece of generated artwork with partial credit instead of all-or-nothing.

### 5. LLM is core (not a sidebar chatbot)
- What the LLM generates/transforms that is the product itself: It turns the task plus current activity (app or page title) into an on-task/off-task verdict with a reason, and turns the finished session into a unique SVG artwork with a title and alt text.
- Why the product can't exist without it: Deciding whether an arbitrary page or app fits an arbitrary user-written task, and creating a unique reward for each session, cannot be done with a fixed blocklist or a fixed image library.

### 6. Validation guardrail
- Artifact(s) the LLM produces: A JSON verdict (label, confidence, reason) and an SVG artwork file with JSON metadata (title, palette, alt text, session ID).
- Validator(s): JSON Schema/Pydantic for the verdict and metadata, a rule layer where the user's blocklist and allowlist override the LLM and low-confidence results become "ask the user," plus an XML/SVG element allowlist (no scripts or external references), size limits, a render test that rejects blank output, and a content-policy check.
- Rule: nothing reaches the user unless it passes. Flow: activity → rules (obvious cases) → LLM → schema check → confidence/override check → PASS: update session; session end → LLM → SVG safety check → render check → policy check → PASS: save to gallery | FAIL: errors → step 7.

### 7. Self-correction loop
- On failure, the validator's error messages are sent back to the LLM with the original prompt
- Max retries: 3, then fail safely. A failed verdict becomes "ask the user" and never ends a session on its own, and failed artwork falls back to a pre-validated piece from a fixed library, so unvalidated output is never shown.

### 8. Deployability
- Deployment target: A containerized API on AWS (Fargate or Lambda) that holds the LLM key and runs the judge and artwork worker, with managed Postgres and S3 plus a CDN for artwork. The Chrome extension is the first client, covering Windows and Mac, with an Electron desktop app as a later stage.
- IaC / CI/CD: Terraform for infrastructure, and GitHub Actions to run tests (including a 30-50 example judge test set), build images, deploy the backend and package the extension.
- Confirmation you can deploy it end to end: Not yet confirmed; deploy one minimal slice (task and page title in, validated verdict out, called from the extension on both a Windows and a Mac machine) through the full pipeline to verify.
