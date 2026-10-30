# Plants

Each session picks one plant from this folder at random. The plant grows while the
session runs, and when the session ends it settles at the size earned by verified
on-task minutes. If a lot of the session was off-task, the plant ends up smaller
than it looked while you were working.

## Adding a plant

1. Put the GIF in this folder. The **first frame should be the seed** and the
   **last frame fully grown**. The GIF doesn't play on its own: the page picks
   which frame to show, so more frames means smoother growth.
2. Add it to `plants.json`:

   ```json
   { "name": "Fern", "file": "fern.gif" }
   ```

3. Reload the FocusGarden page. When running the packaged release, rebuild it
   (`backend\build_release.py`) so the new GIF is bundled.

Only GIFs listed in `plants.json` are used, so you can keep drafts in this folder.

## Settings

- `minutesToFullGrowth` (top level): on-task minutes for a plant to reach its last
  frame. Default 60.
- A plant can override it: `{ "name": "Oak", "file": "oak.gif", "minutesToFullGrowth": 120 }`.

`sample-sprout.gif` is a placeholder; remove it from `plants.json` once you've added
your own.

Transparent backgrounds look best, because the page has light and dark modes.
