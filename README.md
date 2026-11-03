# FocusGarden

A desktop focus tracker with a farm pixel-art garden. Start a task, work, then stop it.
FocusGarden reads what you did from [ActivityWatch](https://activitywatch.net), asks Claude
which apps and sites were on-task, and grows that task's plant by your productive time.

- Up to 3 tasks at once, each shown as an animal in the pen.
- Time splits into productive, unproductive, and idle (away from the keyboard).
- 10 categories, each with its own plant. 36 productive minutes grow a plant through 6
  stages; then it wraps around and earns prestige. Trophies unlock at 1, 10, and 100 total
  prestige.
- Everything stays on your computer except the app names, window titles, and website domains
  sent to Claude for labeling (secrets are redacted first). You bring your own Claude API key,
  stored encrypted with your OS keychain.

## Setup

Requires Node.js 24+.

```bash
npm install
npm run fetch:aw   # downloads the pinned ActivityWatch parts into resources/activitywatch/
npm run dev
```

On first launch the app asks for your Claude API key and starts its bundled ActivityWatch
(or reuses one you already run). macOS asks once to allow Accessibility access so window
titles can be read.

On macOS, Safari and Chromium browsers (Chrome, Edge, Brave, Arc…) are tracked by website
with no extension: the first time you use one during a task, macOS asks whether FocusGarden may
control it. Allow it so the window watcher can read the front tab's address (only the domain is
kept). For Firefox, or other systems, install the ActivityWatch browser extension
(aw-watcher-web). Without either, browsers show up by app and window title.

**Building on your own Mac:** run `npm run setup:mac-signing` once. It creates a
self-signed "FocusGarden Dev" code-signing certificate in your login keychain (macOS asks for
your password to trust it), and every build is then signed with it. Without it, each build gets a
new ad-hoc signature and macOS asks again for Accessibility and keychain access after every
rebuild. To share the app with others, sign it with an Apple Developer ID instead.

**VS Code terminal:** if `npm run dev` fails with
`Cannot read properties of undefined (reading 'isPackaged')`, run
`unset ELECTRON_RUN_AS_NODE` first. VS Code sets it in its terminals.

## Commands

| Command                                           | What it does                                       |
| ------------------------------------------------- | -------------------------------------------------- |
| `npm run dev`                                     | Run the app with hot reload                        |
| `npm test`                                        | Run all tests (Vitest)                             |
| `npm run lint && npm run typecheck`               | ESLint and TypeScript checks                       |
| `npm run test:mutation`                           | Mutation tests for reward and task logic (Stryker) |
| `npm run format`                                  | Format with Prettier                               |
| `npm run fetch:aw`                                | Download ActivityWatch for this platform           |
| `npm run make:art`                                | Regenerate placeholder pixel art (keeps real art)  |
| `npm run build:mac` / `build:win` / `build:linux` | Package the app, with ActivityWatch bundled        |
| `npm run build:unpack`                            | Package without an installer, for a quick check    |
| `npm run setup:mac-signing`                       | One-time: stable signing identity for local builds |

Preview a page with sample data: build with `npx electron-vite build`, then
`node scripts/screenshot.mjs garden garden.png` (`main`, `task`, or `garden`).

## Project docs

- [CLAUDE.md](CLAUDE.md): rules for working on the code
- [docs/rewards.md](docs/rewards.md): how plants grow (source of truth)
- [docs/ui-spec.md](docs/ui-spec.md): the front-end spec
- [docs/architecture.md](docs/architecture.md): how the parts fit together

## Credits

FocusGarden bundles the ActivityWatch server and its window and AFK watchers, licensed under
the [Mozilla Public License 2.0](https://www.mozilla.org/MPL/2.0/). The license ships with the
app in `activitywatch/LICENSE.txt`.
