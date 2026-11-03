# FocusGarden Product Specification

## 1. Core Workflow & ActivityWatch Integration
- **Continuous Tracking**: ActivityWatch tracks user activity (apps, websites, searches) continuously in the background.
- **Task Indexing**: The app indexes the timestamp between when a user starts a task and ends it.
- **Idle Removal (local)**: Idle time comes from ActivityWatch's AFK watcher (no keyboard/mouse input for 3 minutes, its default `timeout`). It is computed locally, removed from the app/website time it overlaps, and **never sent to Claude**.
- **Websites & Searches**: Browser time is split into websites and searches and the browser itself is not listed (no double counting). Sources, in order of preference: the `aw-watcher-web` browser extension (site hostname; searches with their query, e.g. `Google search: react hooks`), otherwise the browser window's page title (Google/DuckDuckGo/Brave results titles become searches). Settings shows whether the extension is connected and links to it; it is optional.
- **AI Classification**: Upon task completion, the remaining apps, websites and searches are bundled into a prompt sent to the **Claude API** to classify each item as *on-task* or *off-task*. Claude is used only for this on/off-task decision.
- **Metrics Calculation**: The app computes total productive time, unproductive time, and idle time; together they add up to the session length.

---

## 2. Page-by-Page UI & Behavior Specifications

### A. Main Page
- **Layout**: 
  - Top 3/4ths: Blue sky background (`#c9ecf9`) with a rectangular window in the center. Title `"FocusGarden"` in top center of the window. A `"Tasks"` button inside takes the user to the Task Page.
  - Outside the window: 5 clouds displaying the names of the 5 most recently completed tasks. Clicking a cloud opens the Task Page and automatically triggers that task's result popup.
  - Bottom 1/4th: Simplified garden representation.
  - A `"Settings"` button opens the setup window (ActivityWatch status, Claude API key, optional website-tracking extension status), closed with `"Close"` (or `"Skip for now"` while a required step is missing). It also offers `"Reset all data"`, which after a confirmation (`"Yes, erase everything"` / `"Cancel"`) erases all tasks, plants, prestige and trophies. The saved API key is kept.

### B. Task Page
- **Layout & State**:
  - Top 2/3rds: Blue sky. Central rectangular window containing:
    1. Text box: `"enter task"`
    2. Dropdown: `"category"` (Lists the 10 categories).
    3. Button: `"start task"` (Spawns an animal in the pen).
  - Outside the window: 5 clouds showing recent completed tasks. Clicking a cloud opens a vertical rectangular popup containing:
    - Task Title at top.
    - Horizontal breakdown bar (% split between on-task, off-task, idle).
    - Subtitle `"What you did:"` followed by a scrollable region of apps, visited sites/pages and searches (showing name, its type — App / Website / Search, total non-idle time, and on/off-task status).
  - Bottom 1/3rd: Animal pen (dirt/straw field with a fenced gate).
- **Animal Pen Logic**:
  - Max **3 animals** active at once. The "start task" button grays out when 3 animals are active.
  - Each active task spawns 1 random animal from the 10-animal pool in the center of its 1/3rd region, featuring a nametag with the task name and a subtle left/right walking/flipping animation.
  - **Home Button**: Dark brown (`#4c2802`) when 0 active tasks (allowing navigation home). Grayed out (`#b7b7b7` / `#666666`) when 1 to 3 tasks are active.
  - **Completing Tasks**: Clicking an animal opens a popup showing elapsed time and a `"Stop"` button. Clicking Stop opens the fence door, and the animal walks out into the horizon and disappears, freeing up a slot.

### C. Garden Page
- **Layout**:
  - Top 1/3rd: Blue sky with 5 clouds with conveyor belt movement. These clouds are purely decorative: no task labels, not clickable.
  - Bottom 2/3rds: Green grass (`#7ab85f`) containing brown rectangular plant plots (90% height of the grass).
- **Plots & Layout**:
  - 10 total plots mapped to the 10 task categories. Plots only appear once a task in that category has been completed.
  - If < 5 plants, centered and symmetric. If > 5 plants, plots 1–5 are in the upper half, and plots 6–10 are in the lower half.
- **Task History (plant click)**:
  - Every completed task is stored, not only the 5 shown as clouds.
  - Clicking a plot opens a vertical popup titled `"<Category> tasks"` (e.g. `"Work tasks"` for the Pine) with a scrollable list of **all** completed tasks in that category, newest first. Each row shows the task name, completion date and on-task time.
  - Clicking a row opens that task's result popup (same as clicking a cloud: title, breakdown bar, `"What you did:"`) on top of the list. Closing it (Close or Esc) returns to the list.
- **Trophy & Prestige System**:
  - Global prestige counter sums up all individual plant prestiges.
  - Trophies under the FocusGarden logo in the upper left:
    - Prestige 1: Bronze Trophy
    - Prestige 10: Silver Trophy
    - Prestige 100: Gold Trophy
- **Growth Mechanics**:
  - **6 stages** per plant. Each stage takes **6 minutes** of productive time (36 minutes total per full cycle).
  - Plants grow upon *task completion* (not in real-time while viewing the garden).
  - If progress lands mid-stage, the image scales up slightly to simulate intermediate growth.
  - **Prestige Wrapping**: When a plant reaches 100% growth and receives excess minutes, the cycle wraps around to stage 1 with the remainder, and plant **prestige increments by 1**.