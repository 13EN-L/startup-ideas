# FocusGarden Architecture

How the parts fit together. Behavior rules live in `docs/rewards.md` (growth) and
`docs/ui-spec.md` (front end); this file covers structure and data flow. The back end
may change as long as it stays lightweight and keeps the behavior in those docs.

## Overview

```
ActivityWatch (aw-server + watchers, bundled)
        │  local REST API
        ▼
src/main/activity/   reads window, web, and AFK events for a task's time range
        │
src/main/tasks/      starts/stops tasks, builds each task's activity summary
        │
src/main/classifier/ sends the summary to Claude, gets on-task/off-task labels
        │
src/main/rewards/    pure functions: buckets, growth, stages, prestige, trophies
        │
src/main/db/         SQLite: tasks, results, plant progress
        │  IPC (preload)
        ▼
src/renderer/        React: main page, task page, garden page
```

All work happens in the main process. The renderer only displays state and sends
user actions through the preload bridge.

## ActivityWatch

- We bundle ActivityWatch's server and three watchers:
  - **Window watcher:** active app name and window title.
  - **AFK watcher:** whether the user is active or idle.
  - **Web watcher:** active tab's URL and title. This one runs as a browser
    extension, so the user has to install it in their browser for site-level data.
- On launch, check whether an ActivityWatch server is already running (the user may
  have it installed). Reuse it if so; otherwise start our bundled copy.
- ActivityWatch records continuously and on its own. We read past events by time
  range, so our app doesn't need to be open during a task, only ActivityWatch.
- **Closing the window:** closing it doesn't stop ActivityWatch. If tasks are
  active, keep ActivityWatch running so tracking continues while the app is closed.
- `src/main/activity/` is the only code that talks to ActivityWatch.

## Task lifecycle

```
active ──stop──► pending ──classified──► done
                    ▲            │
                    └──retry─────┘ (API failed or invalid output)
```

1. **Start:** save the task (name, category, animal, start time) to SQLite right
   away, with status `active`. Pick the animal from those not already in the pen.
2. **Stop:** save the stop time, set status `pending`.
3. **Summarize:** read ActivityWatch events from start to stop and build the
   activity summary (below). The idle percentage and app/site list can show now.
4. **Classify:** send the summary to Claude. On success, save labels and set
   status `done`. On failure, stay `pending` and retry with backoff, and again
   on every app launch.
5. **Grow:** once `done`, apply the task's productive time to its category's plant.
   Labels are final; a `done` task is never classified again.

## Building the activity summary

For a task's time range:

1. Get window, web, and AFK events, clipped to the range.
2. Spans where the AFK watcher says the user is away are **idle**.
3. For non-idle time, decide what the user was doing. When the active app is a
   browser and web data exists, use the website domain and tab title; otherwise use
   the app name and window title.
4. Merge overlapping events so each second is counted once.
5. Group time by item (app, or website/search) and total the seconds for each.
6. Redact anything that looks like a secret from titles before it leaves the device.

The summary keeps the time intervals behind each item, since growth needs them for
same-category overlap (below).

## Classification

- One Claude API call per task, made by `src/main/classifier/` only.
- Input: task name, category, and the list of items (app name, window title,
  domain). No full URLs. Time per item isn't needed for labeling.
- Output: JSON with an on-task/off-task label for each item, validated with `zod`.
  Any missing or invalid label means the whole result is rejected and retried.
- Keep the model name and prompt in the classifier module, versioned with the code.
- Keep requests small: cap the number of items per task and the title length.

## Growth

Runs once per task, when it becomes `done`:

1. Productive intervals = the task's non-idle intervals for on-task items.
2. **Same-category overlap:** subtract any time already credited to this category
   by another task. Different categories don't affect each other.
3. Add the remaining seconds to the category's plant total, and record those
   intervals as credited.
4. If this is the category's first completed task, create its plant and plot, even
   with 0 seconds added.

Stage, scale, prestige, and trophies are all derived from plant totals by the pure
functions in `src/main/rewards/`, never stored separately.

## Data (SQLite)

| Table                | Holds                                                           |
| -------------------- | --------------------------------------------------------------- |
| `tasks`              | id, name, category, animal, start and stop times, status        |
| `task_items`         | per task: item name, app, title, domain, seconds, label         |
| `task_buckets`       | per task: productive, unproductive, idle seconds                |
| `plants`             | per category: total productive seconds, order it first appeared |
| `credited_intervals` | per category: time spans already counted toward growth          |

The 5 recent-task clouds come from the 5 most recently stopped tasks. Schema changes
always go through a new migration.

## Main ↔ renderer (preload)

The preload script exposes a small, typed API, for example:

- **Tasks:** start task, stop task, list active tasks, list recent tasks, get a
  task's results.
- **Garden:** get garden state (plants in order, stage, scale, prestige, trophies).
- **Settings:** save the Claude API key (main stores it in `safeStorage`).
- **Events:** main notifies the renderer when task results are ready or the garden
  changes.

The renderer never calls ActivityWatch or the Claude API and never sees the API key.

## App startup

1. Make sure ActivityWatch is running.
2. Load state from SQLite.
3. Retry classification for any `pending` tasks.
4. If any tasks are `active`, open the task page (home sign greyed out); otherwise
   open the main page.

## Keeping it light

- No background polling of ActivityWatch while tasks run. Read events once, at stop.
- The elapsed-time popup is computed from the task's start time, not tracked live.
- Garden math runs only when a task completes or the garden page opens.
