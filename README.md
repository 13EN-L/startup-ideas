# FocusGarden

FocusGarden is a desktop app that turns focused work into a growing farm.

You tell it what you're working on, and an animal walks into your pen to keep you company. When you finish, FocusGarden looks at the apps and websites you actually used during that time, asks Claude which of them were on-task, and turns your productive minutes into plant growth. Keep focusing and your plants mature, wrap around into prestige levels, and earn you trophies.

## How it works

1. **[ActivityWatch](https://activitywatch.net)**, a free app, runs in the background and records which app and browser tab are active, plus when you're away from the keyboard.
2. When you **start a task**, FocusGarden notes the time. When you **stop** it, FocusGarden reads your ActivityWatch history for exactly that window.
3. The list of apps and websites goes to **Claude**, which labels each one *on-task* or *off-task* for the task you named. Every answer is checked before it's used; incomplete or malformed answers are sent back to Claude to correct, up to three attempts.
4. FocusGarden splits the session into **productive**, **unproductive** and **idle** time, shows you the breakdown, and grows the plant for that task's category by the productive minutes.

Everything is stored on your computer. See [Privacy](#privacy) for what is sent to Claude.

## Install

All you need besides FocusGarden is **an Anthropic API key** from the [Claude Console](https://console.anthropic.com/settings/keys). Each completed task makes one small Claude request.

### Windows

Download from the project's **Releases** page on GitHub and pick one:

- **Installer (recommended):** `FocusGarden-<version>-Windows-Setup.exe`. Double-click it. FocusGarden installs for your user account (no administrator password), adds Start menu and desktop shortcuts, and opens.
- **No install:** `FocusGarden-<version>-Windows.zip`. Right-click it, choose **Extract All…**, open the extracted folder and double-click **FocusGarden.exe**. Keep the folder together; the other files in it are part of the app.

**ActivityWatch is included.** You don't install or configure it separately: FocusGarden starts it automatically every time it opens.

**"Windows protected your PC"?** FocusGarden isn't code-signed yet, so Windows SmartScreen warns on first launch. Click **More info**, then **Run anyway**. You'll only see this once.

### macOS

Download `FocusGarden-<version>-macOS.dmg`, open it and drag **FocusGarden** into **Applications**. The first time, right-click FocusGarden in Applications and choose **Open** (the app isn't notarized by Apple yet, so a normal double-click is blocked the first time).

On macOS, ActivityWatch is not included yet: also install it from [activitywatch.net/downloads](https://activitywatch.net/downloads/) and start it. The setup window links there.

### Linux

Download `FocusGarden-<version>-Linux.AppImage`, make it executable and run it:

```bash
chmod +x FocusGarden-*-Linux.AppImage
./FocusGarden-*-Linux.AppImage
```

As on macOS, install and start [ActivityWatch](https://activitywatch.net/downloads/) yourself.

### First launch

The first time FocusGarden opens, a **Set up FocusGarden** window shows two steps:

1. **ActivityWatch.** On Windows this is already done: FocusGarden has started it, and the step shows a check mark after a few seconds. On macOS and Linux, click **Download ActivityWatch**, install and start it, then click **Check again**.
2. **Claude API key.** Click **Get an API key** if you don't have one, paste it into the box and click **Save key**. FocusGarden checks the key with Anthropic and stores it encrypted on your computer.

Click **Start** when both steps show a check mark. You can click **Skip for now** to look around first, and reopen this window any time with **Settings** on the main page.

**Optional, for website tracking:** FocusGarden sees which *apps* you use out of the box. To also see which *websites*, add the ActivityWatch browser extension (**aw-watcher-web**) from the Chrome Web Store or Firefox Add-ons. Browsers only let you install extensions yourself, so this can't be done for you.

### ActivityWatch in the background

On Windows, the ActivityWatch that comes with FocusGarden appears as an icon in the system tray (near the clock). It keeps tracking after you close FocusGarden, so a task you leave running still gets counted. To stop it, right-click the tray icon and choose **Quit**; FocusGarden starts it again the next time it opens. If you already had ActivityWatch installed and running, FocusGarden uses yours instead.

### Uninstall

- **Installer:** Windows Settings → **Apps** → **FocusGarden** → **Uninstall**. This also stops and removes the included ActivityWatch.
- **Zip:** quit ActivityWatch from its tray icon, then delete the folder.
- **macOS:** drag FocusGarden from Applications to the Trash.

Your garden and settings are kept in case you reinstall. To remove them too, delete the data folder listed under [Your data](#your-data). ActivityWatch keeps its own history in `%LOCALAPPDATA%\activitywatch`; delete that folder too if you want it gone.

## Using FocusGarden

### Main page

The sky shows the **FocusGarden** window with a **Tasks** button. Clouds around the window carry the names of your five most recently completed tasks, and the strip of grass along the bottom is a preview of your garden.

- **Tasks** opens the Task page.
- **Click a cloud** to jump to the Task page with that task's results open.
- **Click the garden strip** to open the Garden page.
- **Settings** reopens the setup window (ActivityWatch status and your API key).

### Starting a task

On the Task page:

1. Type what you're working on in **enter task**.
2. Pick one of the ten categories in the **category** dropdown.
3. Click **start task**.

An animal (one of cow, horse, pig, sheep, dog, duck, chicken, donkey, goat or cat) appears in the pen with your task name on a nametag and wanders back and forth while you work.

- You can run **up to three tasks at once**. With three animals in the pen, **start task** is greyed out.
- While any task is running, the **Home** sign is greyed out. Finish your tasks to leave the Task page.

### Finishing a task

1. **Click the task's animal.** A popup shows how long the task has been running.
2. Click **Stop**. The gate swings open and the animal walks out of the pen.
3. FocusGarden analyses the session (this takes a few seconds). When it's done, a new cloud with the task's name appears in the sky.

Click **Close** (or press Esc) to dismiss the popup without stopping the task.

### Reviewing a task

Click any cloud to open that task's results:

- A **bar** showing the split between on-task (green), off-task (brown) and idle (grey) time.
- **What you did:** every app and website from the session, with time spent and whether it counted as on-task or off-task, longest first.

### The garden

Each of the ten categories grows its own plant. A plot appears the first time you complete a task in that category.

| Category | Plant |
|---|---|
| Work | Pine |
| School / Study | Tomato |
| Health & Fitness | Apple |
| Finance | Lilac |
| Home | Corn |
| Relationships | Sunflower |
| Personal Growth | Carrot |
| Creative | Basil |
| Career Development | Succulent |
| Self-Care | Monkeygrass |

**Growth.** Plants have 6 stages, and each stage takes 6 minutes of *productive* time, so a full cycle is 36 minutes. Off-task and idle time don't count. Plants grow when you finish a task, not while the app is open. Partway through a stage, the plant grows slightly larger.

**Prestige.** Productive time beyond a full-grown plant starts the plant over at stage 1 with the leftover minutes and gives it **+1 prestige**. A plant's prestige is shown on its plot.

**Trophies.** Prestige from all your plants adds up to a total shown under the logo, where you earn trophies:

| Total prestige | Trophy |
|---|---|
| 1 | Bronze |
| 10 | Silver |
| 100 | Gold |

### Closing and reopening

FocusGarden saves after every change. If you close it with tasks running, it reopens on the Task page with your animals still in the pen and their timers still counting from when you started. Otherwise it reopens on the page you left.

### Your data

Your garden (`focusgarden-state.json`) and settings (`settings.json`) live in one folder:

| OS | Folder |
|---|---|
| Windows | `%APPDATA%\FocusGarden` |
| macOS | `~/Library/Application Support/FocusGarden` |
| Linux | `~/.config/FocusGarden` |

Deleting `focusgarden-state.json` resets your garden. Your API key in `settings.json` is encrypted with your operating system's credential protection, so it only works for your user account on this computer.

## Privacy

- ActivityWatch data stays on your computer. FocusGarden reads it only for the time between starting and stopping a task.
- For each completed task, FocusGarden sends Claude the **task name, its category, and the list of app names and website domains** (for example `Code` or `github.com`) with time spent on each. It does **not** send window titles, full URLs or page contents.
- When you save an API key, FocusGarden makes one request to Anthropic to check that the key works.

## Troubleshooting

**"Could not analyze …" after stopping a task.** Usually ActivityWatch isn't running, or no API key is saved. Open **Settings** on the main page to see which, fix it, and run your next task as normal. The failed session's results aren't saved.

**Settings says ActivityWatch "couldn't be started" (Windows).** Click **Try again**. If it still fails, another program may be using port 5600, or security software may have blocked `aw-qt.exe` in FocusGarden's install folder.

**"Anthropic rejected this key."** The key was mistyped, revoked or belongs to a disabled account. Create a new key in the [Claude Console](https://console.anthropic.com/settings/keys) and paste it again.

**Websites never appear in "What you did:".** Install the ActivityWatch browser extension (aw-watcher-web) for your browser.

**Opening FocusGarden again just brings up the existing window.** That's intentional: only one copy runs at a time so two windows can't overwrite each other's garden.

## Replacing the artwork

Animals, plants, clouds and trophies currently use transparent placeholder images, outlined with dashed boxes so you can see where art will go. To add real art, save PNGs over the files in `public/assets/`, then rebuild:

```
public/assets/
├── animals/<animal>.png              cow.png, horse.png, …
├── plants/<plant>/stage-1.png … stage-6.png
├── clouds/cloud.png
└── trophies/bronze.png, silver.png, gold.png
```

`npm run assets:placeholders` recreates any missing placeholders and never overwrites real art.

## For developers

### Run from source

Requires [Node.js](https://nodejs.org) 22 LTS or newer.

```bash
git clone https://github.com/13EN-L/startup-ideas.git
cd startup-ideas
npm install
npm run dev
```

`npm run dev` opens the app with hot reload for the interface. You can enter your API key in the setup window, or set the `ANTHROPIC_API_KEY` environment variable; a key saved in the app takes priority.

On Windows, run `npm run activitywatch:fetch` once so `npm run dev` can start the bundled ActivityWatch too. Without it, start ActivityWatch yourself.

If the window opens blank when launched from an editor's terminal, the editor may be leaking `ELECTRON_RUN_AS_NODE=1` (VS Code does). Clear it first: `Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell, `unset ELECTRON_RUN_AS_NODE` in bash.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app with hot reload |
| `npm run build` | Builds the app into `dist/` and `dist-electron/` |
| `npm start` | Opens the built app |
| `npm run dist:win` | Downloads ActivityWatch, then builds the Windows installer and zip into `release/` |
| `npm run activitywatch:fetch` | Downloads the bundled ActivityWatch into `vendor/` (checksum-verified) |
| `npm run dist:mac` | Builds the macOS `.dmg` (must run on a Mac) |
| `npm run dist:linux` | Builds the Linux AppImage |
| `npm test` | Unit, integration and property-based tests |
| `npm run test:e2e` | Builds, then drives the real app with Playwright, using fake ActivityWatch and Claude services |
| `npm run test:mutation` | Mutation testing with Stryker (requires the other tests to pass) |
| `npm run typecheck` | TypeScript checks for the app and tests |

### Publishing a release

1. Bump `version` in `package.json`.
2. Run `npm run dist:win` on Windows, `npm run dist:mac` on a Mac, and `npm run dist:linux` on Linux. Each writes its files to `release/`.
3. Create a GitHub release and attach `FocusGarden-<version>-Windows-Setup.exe`, `FocusGarden-<version>-Windows.zip`, `FocusGarden-<version>-macOS.dmg` and `FocusGarden-<version>-Linux.AppImage`.

Packaging is configured in [electron-builder.yml](electron-builder.yml). The builds are unsigned; signing with a Windows code-signing certificate and an Apple Developer ID would remove the SmartScreen and Gatekeeper warnings described above.

The Windows build bundles ActivityWatch's official portable release. Its version and SHA-256 checksum are pinned in [scripts/fetch-activitywatch.mjs](scripts/fetch-activitywatch.mjs); to upgrade, change both there. [build/installer.nsh](build/installer.nsh) stops the bundled copy before FocusGarden is upgraded or uninstalled.

## Credits

FocusGarden's Windows build includes [ActivityWatch](https://activitywatch.net), redistributed unmodified under the [Mozilla Public License 2.0](https://github.com/ActivityWatch/activitywatch/blob/master/LICENSE.txt). Its licence and a link to its source code are installed alongside it in `resources\activitywatch\`.

### Code layout

- `src/core/`: growth, prestige, task and save-file logic, with no Electron or UI dependencies.
- `src/main/`: the Electron main process, which talks to ActivityWatch, Claude, the save file and the settings file.
- `src/renderer/`: the React interface.

The full product rules are in [docs/product-spec.md](docs/product-spec.md) and [docs/design-tokens.md](docs/design-tokens.md), and contributor guidelines are in [CLAUDE.md](CLAUDE.md).
