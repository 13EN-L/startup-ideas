# FocusGarden Front-End Spec

The front end must follow this spec exactly. Ask before changing layout or behavior.

## Color palette

| Hex       | Name        | Used for                                         |
| --------- | ----------- | ------------------------------------------------ |
| `#4c2802` | Dark brown  | Major text, outlines, logo, dirt, buttons, signs |
| `#8c4c0c` | Light brown | Sign posts                                       |
| `#f7f3ec` | Beige       | Popup backgrounds, button text                   |
| `#7ab85f` | Green       | Grass                                            |
| `#f3f3f3` | White       | Text boxes the user types in                     |
| `#c9ecf9` | Blue        | Sky                                              |
| `#b7b7b7` | Light grey  | Sign post (deactivated)                          |
| `#666666` | Dark grey   | Sign (deactivated)                               |

## App-wide behavior

- **Resume where the user left off.** If the app is closed while tasks are active,
  reopening it starts on the task page with the home sign greyed out, so the user
  keeps working on their tasks.
- **Tracking continues while closed.** Closing the window doesn't stop active tasks:
  ActivityWatch keeps recording in the background, and that time counts toward the
  tasks when they're stopped.
- **Placeholder art.** Clouds, animals, plants, and other images are blank PNGs until
  real art exists. Swapping in real art must only mean replacing the file.
- **Recent-task clouds.** On the main and task pages, 5 clouds show the names of the
  5 most recently completed tasks.
- **Pixel-art style.** Everything looks like farm pixel art: the bundled Pixelify Sans
  font, hard 4px dark-brown outlines with notched corners, no rounded corners,
  gradients, blur, or soft shadows, images scaled with `image-rendering: pixelated`,
  and motion in whole steps (`steps()` timing).

### API key popup

A small beige popup titled "Connect Claude" that asks for the user's Claude API key.

- **When it shows:** on launch, over whichever page opens, if no key is saved.
- **Contents, top to bottom:** the title; one sentence on why the key is needed and
  that it's stored encrypted on this computer; a password-masked text box labeled
  "Claude API key"; "cancel" and "save" buttons ("save" is greyed out while the box
  is empty).
- **Save:** sends the key to the main process (stored with `safeStorage`), clears the
  box, and closes. If saving fails, an error line appears and the popup stays open.
- **Cancel** (or Esc / the close button): closes without saving. Tasks still run and
  wait for results; the popup asks again on the next launch.

## Main page

**Sky (top 3/4).** Blue sky with a rectangular window in the middle.

- "FocusGarden" title, top center of the window.
- A "Tasks" button in the window opens the task page.
- 5 recent-task clouds outside the window. Clicking one opens the task page with that
  task's results popup already open.

**Garden preview (bottom 1/4).** A simplified version of the garden.

- Clicking anywhere in this area opens the garden page.
- The first plant sits in the middle of this long panel. Each new plant is added side
  by side, shifting earlier plants left so the row stays roughly symmetrical.

## Task page

**Sky (top 2/3).** Blue sky with a rectangular window in the middle containing,
top to bottom:

1. A text box with the placeholder "enter task".
2. A "category" dropdown listing the 10 categories.
3. A "start task" button at the bottom of the window. Pressing it turns the entered
   task into an in-progress task (an animal in the pen).
   - Greyed out when 3 animals are in the pen; active when there are 2 or fewer.

Outside the window: 5 recent-task clouds. Clicking one opens that task's results popup.

**Pen (bottom 1/3).** A dirt/straw field fenced in, with a gate.

- **Spawning:** starting a task spawns an animal, chosen at random from the animal
  pool, in the pen. Active tasks always get different animals: pick only from
  animals not already in the pen. Spawn points are the centers of the pen's 3 equal sections.
- **Nametag:** a rectangle above the animal shows its task's name.
- **Idle animation:** the animal moves very slightly left and right in place, turning
  by flipping its image horizontally.
- **Limit:** at most 3 animals (3 active tasks).
- **Home sign:** a fence sign labeled "home".
  - No active tasks: dark brown and clickable (leaves the page).
  - 1 to 3 active tasks: greyed out (deactivated colors) and not clickable.
- **Stopping a task:** clicking an animal opens a popup showing the time elapsed since
  it spawned, with a "stop" button below. Pressing stop completes the task: the gate
  opens, the animal walks out toward the horizon and disappears, and its spot frees up.

### Task results popup

A vertical rectangle, top to bottom:

1. **Title:** the task name.
2. **Time bar:** a horizontal bar divided into on-task, off-task, and idle, each
   section labeled with its percentage. Colors: on-task green (`#7ab85f`), off-task
   light brown (`#8c4c0c`, beige label), idle light grey (`#b7b7b7`); labels dark
   brown. Empty sections are hidden; percentages always add up to 100.
3. **"What you did:"** subtitle.
4. **Scrollable list** of the apps and sites/searches visited. Each row shows the
   name, total time spent, and whether it was on-task or off-task.

**While results are pending** (classification still running, or failed and retrying):

- A farm-themed loading spinner with a short message in place of the on-task and
  off-task sections of the bar.
- The idle percentage and the app/site list (names and times) show right away, since
  they come from ActivityWatch.
- On-task/off-task labels and percentages fill in once Claude's results arrive.

## Garden page

**Sky (top 1/3).** Blue sky with 5 clouds moving across like a conveyor belt. These
clouds are decorative only: no task names, not clickable.

**Logo and trophies.** The FocusGarden logo is in the upper left. Trophies for global
prestige sit right under it (bronze at 1, silver at 10, gold at 100; see
`docs/rewards.md`).

**Grass (bottom 2/3).** A green rectangle.

- **Plots:** brown rectangles, one per category that has a plant (up to 10). Plot
  width depends on how many plots there are. Plots are placed in the order their
  plants first appeared.
- **Plot height:** 90% of the grass height with one row. With two rows, 90% of that
  row's height.
- **Plants:** each plot holds one plant, drawn at its current stage and scale-up
  (see `docs/rewards.md`). A prestige count sits in the plot's corner.
- **Layout, 5 or fewer plants:** the first plant is centered. Each new one is added
  beside the others, shifting them left so the row stays roughly symmetrical.
- **Layout, 6 to 10 plants:** plants 1 to 5 move to the upper half of the garden and
  plants 6 to 10 go in the lower half, below them.
- **Home sign:** dark brown; returns to the main page.

## Animal pool

Cow, Horse, Pig, Sheep, Dog, Duck, Chicken, Donkey, Goat, Cat.

## Assets needed

Each needs a placeholder PNG until real art exists:

- 10 plants × 6 stages
- 10 animals
- Clouds
- Farm-themed loading spinner
- Bronze, silver, and gold trophies
- FocusGarden logo
- Home sign (active and deactivated), fence, and gate
