# FocusGarden

Desktop productivity tracker. The user starts a task (name + category). While it runs,
a bundled ActivityWatch records the apps and websites/searches they use. When the task
is stopped, that activity is sent to Claude, which labels each app/site on-task or
off-task. The app splits the task's time into productive, unproductive, and idle, and
productive time grows the plant for that task's category in the garden.

Pipeline: start task → ActivityWatch records → stop task → Claude labels each app/site
→ productive / unproductive / idle totals → plant growth → garden UI.

**Priorities:** the front end in `docs/ui-spec.md` must be followed exactly. The back
end is flexible as long as it works well and stays lightweight (low CPU and memory,
small app size).

## Stack

- Electron desktop app, TypeScript (strict), npm
- React for the renderer UI
- SQLite for local storage (tasks, task results, plant progress)
- ActivityWatch bundled and launched by our app; we read its window, web, and AFK
  watcher data from its local REST API
- Claude API labels each app/site as on-task or off-task
- Fully local: no accounts, no backend server; all user data stays on the device
  except what is sent to the Claude API for classification

## Commands

Build tool: electron-vite. Tests: Vitest.

- `npm install` — install dependencies
- `npm run dev` — run the app with hot reload
- `npm test` — run all Vitest tests
- `npm run lint` — ESLint
- `npm run format` — Prettier
- `npm run test:mutation` — mutation testing with Stryker (slow; run on changed logic)
- `npm run typecheck` — TypeScript check for main and renderer
- `npm run build` — production build
- `npm run lint && npm run typecheck && npm test` — must pass before any commit

## Domain rules (read before touching tasks, classification, rewards, or time tracking)

### Tasks

- A task has a name, one of 10 categories, a random animal from the animal pool, a
  start time, and an end time. Categories, plants, and animals are listed in
  `docs/rewards.md` and `docs/ui-spec.md`.
- At most 3 tasks can be active at once.
- Save active tasks to SQLite as soon as they start. They must survive the app
  being closed and reopened.
- A task's tracked window is from when it starts to when it's stopped. Tracking
  continues while the app window is closed: ActivityWatch keeps running in the
  background.
- Active tasks always have different animals.

### Classification (Claude API)

- All Claude API calls go through one module (`src/main/classifier/`). No other
  code calls the API directly.
- Classification runs once per task, when the task is stopped.
- Send the task name and category, plus each app and website/search used during the
  task: app name, window title, and website domain only (no full URL paths or query
  strings, which can contain tokens or personal data).
- Claude labels each app/site on-task or off-task for that specific task, judging
  from context (e.g. a YouTube lecture is on-task for a study task). There are no
  user overrides.
- Time spent per app/site comes from ActivityWatch, never from Claude.
- Request structured JSON output and validate it with `zod`. If the call fails or
  the output is invalid, the task waits for results and is retried. It adds no
  growth until labeled. Never default anything to on-task. After 5 failed retries
  (per app session), label every item off-task and complete the task; a missing or
  rejected API key never triggers this (see `docs/rewards.md`).
- Labels are final. A labeled task is never sent to Claude again.

### Time accounting

- Idle = AFK time from ActivityWatch's AFK watcher. Idle is its own bucket and is
  never productive.
- Productive = on-task, not idle. Unproductive = off-task, not idle.
- Never count the same span of time twice when ActivityWatch events overlap.
- A task's productive time goes to the plant for the category picked in its
  dropdown. Overlapping tasks in different categories each grow their own plant;
  overlapping tasks in the same category don't stack (each second counts once
  for that plant).
- Store all timestamps in UTC; convert to local time only for display.

### Rewards

- Full rules and examples are in `docs/rewards.md`. If this summary and that file
  ever disagree, `docs/rewards.md` wins; fix this file to match.
- One plant per category (10 total). A plant and its plot appear only after the
  first task in that category is completed.
- 6 stages × 6 minutes = a 36-minute cycle. Within a stage the image scales up
  linearly to 110%. Keep these in constants: `MINUTES_PER_STAGE = 6`,
  `MINUTES_PER_PLANT = 36`, `MAX_STAGE_SCALE_UP = 0.10`. Track seconds, not whole
  minutes.
- Growth is applied only when a task is completed, as one sum. Plants never grow in
  real time.
- Finishing a cycle wraps back to stage 1 and adds 1 prestige to that plant. Global
  prestige is the sum of all plants' prestige; it unlocks trophies at 1, 10, and 100.
- All reward math lives in `src/main/rewards/` as pure functions. Never compute
  growth in React components or the classifier.
- If something isn't covered by `docs/rewards.md` or `docs/ui-spec.md`, don't
  invent an answer; ask.

## Conventions

- Use the electron-vite layout:
  - `src/main/` — Electron main process: ActivityWatch, classifier, rewards, SQLite
  - `src/preload/` — the only bridge between main and renderer
  - `src/renderer/` — React UI (main, task, and garden pages)
- Formatting is handled by Prettier. Run `npm run format`; don't hand-format.
- Colors live in one theme file and match the palette in `docs/ui-spec.md`. Never
  hardcode hex values in components.
- All art (plants, animals, clouds, trophies, etc.) loads through one asset manifest
  in `src/renderer/assets/`. Missing art is a blank placeholder PNG, so replacing the
  file is all it takes to update it.

## Privacy

- Users bring their own Claude API key. Store it encrypted with Electron's
  `safeStorage` (OS keychain), never in SQLite, config files, or logs.
- Only the main process reads the key or calls the Claude API. The renderer never
  sees the key.
- No consent screen and no activity filtering: all activity during a task is sent
  for classification (app name, window title, domain only), with secrets redacted
  first (see Never).
- Activity data is personal. Don't log window titles or domains at info level.
- Never add analytics, telemetry, or any network call other than the Claude API
  without asking.

## Never

- Change front-end layout or behavior away from `docs/ui-spec.md` without asking.
- Commit directly to `main`. Always work on a branch.
- Change the SQLite schema in place. Always add a new migration.
- Weaken Electron security: keep `contextIsolation` on, `nodeIntegration` off in the
  renderer, and expose only narrow functions through the preload script.
- Send passwords, API keys, tokens, card numbers, or similar secrets to Claude.
  Redact anything that looks like one before sending.
- Commit `.env*` files or hardcode secrets.
- Change reward behavior silently. Call it out in the summary.

## Done means

- Work test-first (TDD): write a failing test, make it pass, then refactor.
- `npm run lint && npm run typecheck && npm test` all pass.
- New logic has tests. Reward and time-accounting tests cover edge cases: stage
  boundaries, wrap-around and prestige, trophies at 1/10/100, idle time, overlapping
  events, failed classification, 3 active tasks, and reopening with active tasks.
- Classifier tests mock the Claude API. Tests never make real API calls.
- When reward or time-accounting code changes, run `npm run test:mutation` on it
  and add tests for surviving mutants where practical.
- UI changes are checked against `docs/ui-spec.md`.
- Summarize what changed, including anything that affects plant growth.

## More detail

- Reward rules and examples: @docs/rewards.md
- Front-end spec (pages, layout, colors, assets): @docs/ui-spec.md
- Pipeline architecture (ActivityWatch → classifier → rewards → UI): @docs/architecture.md
