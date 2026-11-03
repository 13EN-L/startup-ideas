# FocusGarden

FocusGarden is a desktop app that turns focused work into a growing farm.

You tell it what you're working on, and an animal walks into your pen to keep you company. When you finish, FocusGarden looks at the apps and websites you actually used during that time, asks Claude which of them were on-task, and turns your productive minutes into plant growth. Keep focusing and your plants mature, wrap around into prestige levels, and earn you trophies.

## How it works

1. **[ActivityWatch](https://activitywatch.net)**, a free app, runs in the background and records which app is in front (with its window title), which website your browser shows, and when you're away from the keyboard.
2. When you **start a task**, FocusGarden notes the time. When you **stop** it, FocusGarden reads your ActivityWatch history for exactly that window.
3. On your computer, FocusGarden takes out the time you were away (**idle**), then splits browser time into the **websites** and **searches** you used. See [What counts as idle](#what-counts-as-idle) and [Websites and searches](#websites-and-searches).
4. The remaining list of apps, websites and searches goes to **Claude**, which labels each one *on-task* or *off-task* for the task you named. Idle time is never sent. Every answer is checked before it's used; incomplete or malformed answers are sent back to Claude to correct, up to three attempts.
5. FocusGarden splits the session into **productive**, **unproductive** and **idle** time, which add up to the length of the session, shows you the breakdown, and grows the plant for that task's category by the productive minutes.

Everything is stored on your computer. See [Privacy](#privacy) for what is sent to Claude.

## Install

All you need besides FocusGarden is **an Anthropic API key** from the [Claude Console](https://console.anthropic.com/settings/keys). Each completed task makes one small Claude request.

### Windows

Download from the project's **Releases** page on GitHub and pick one:

- **Installer (recommended):** `FocusGarden-<version>-Windows-Setup.exe`. Double-click it. FocusGarden installs for your user account (no administrator password), adds Start menu and desktop shortcuts, and opens.
- **No install:** `FocusGarden-<version>-Windows.zip`. Right-click it, choose **Extract All…**, open the extracted folder and double-click **FocusGarden.exe**. Keep the folder together; the other files in it are part of the app.

**ActivityWatch is included.** You don't install or configure it separately: FocusGarden starts it automatically every time it opens, and sets it to start whenever you sign in to Windows (see [Does FocusGarden need to be open?](#does-focusgarden-need-to-be-open)).

**"Windows protected your PC"?** FocusGarden isn't code-signed yet, so Windows SmartScreen warns on first launch. Click **More info**, then **Run anyway**. You'll only see this once.

### macOS

Download the file for your Mac. To check which you have, open  → **About This Mac**: **Chip: Apple M…** means Apple silicon, **Processor: Intel…** means Intel.

- **Apple silicon (M1 and later):** `FocusGarden-<version>-macOS-arm64.dmg`
- **Intel:** `FocusGarden-<version>-macOS-x64.dmg`

Open the `.dmg` and drag **FocusGarden** into **Applications**. The first time, right-click FocusGarden in Applications and choose **Open** (the app isn't notarized by Apple yet, so a normal double-click is blocked the first time).

**ActivityWatch is included,** as on Windows. FocusGarden starts it when it opens and sets it to start whenever you log in. It appears as an icon in the menu bar.

**Allow ActivityWatch to see your windows.** The first time ActivityWatch runs, macOS asks whether it may control your computer (**Accessibility**) and, on newer macOS, record your screen (**Screen Recording**); ActivityWatch needs these only to read which app and window title is in front, and records no images. Allow both in **System Settings → Privacy & Security**, then quit ActivityWatch from its menu bar icon and open FocusGarden again. Without them, ActivityWatch can't see which apps you use.

**"Background Items Added"** appears once on macOS 13 and later when FocusGarden sets ActivityWatch to start at login. That's expected; you can manage it in **System Settings → General → Login Items**.

### Linux

Download `FocusGarden-<version>-Linux.AppImage`, make it executable and run it:

```bash
chmod +x FocusGarden-*-Linux.AppImage
./FocusGarden-*-Linux.AppImage
```

On Linux, ActivityWatch is not included: install and start [ActivityWatch](https://activitywatch.net/downloads/) yourself, and use its own settings to start it when you log in.

### First launch

The first time FocusGarden opens, a **Set up FocusGarden** window shows two steps:

1. **ActivityWatch.** On Windows and macOS this is already done: FocusGarden has started it, and the step shows a check mark after a few seconds. **Start ActivityWatch when I sign in** is ticked, so tracking carries on after a restart. On Linux, click **Download ActivityWatch**, install and start it, then click **Check again**.
2. **Claude API key.** Click **Get an API key** if you don't have one, paste it into the box and click **Save key**. FocusGarden checks the key with Anthropic and stores it encrypted on your computer.
3. **Website tracking (optional).** FocusGarden already sees websites and Google searches from your browser's page titles. For exact websites and searches on every search engine, click **Chrome / Edge extension** or **Firefox add-on** to install the ActivityWatch browser extension (**aw-watcher-web**), browse for a moment, then click **Check for the extension**. Browsers only let you install extensions yourself, so this can't be done for you.

Click **Close** when the first two steps show a check mark. You can click **Skip for now** to look around first, and reopen this window any time with **Settings** on the main page.

### Does FocusGarden need to be open?

**No, only ActivityWatch does.** When you start a task, FocusGarden notes the time. When you stop it, FocusGarden asks ActivityWatch for everything it recorded in between. So you can start a task, close FocusGarden, even restart your computer, and stop the task later: the whole session is counted, as long as ActivityWatch was running the whole time. Time when ActivityWatch wasn't running is simply missing from the task.

That's why FocusGarden sets the ActivityWatch it includes to **start when you sign in** to Windows or log in to your Mac. Turn this off or on in **Settings → Start ActivityWatch when I sign in**. On Windows it's a normal startup app (you'll also see it in Task Manager → **Startup apps**); on macOS it's a login item (`~/Library/LaunchAgents/com.focusgarden.activitywatch.plist`).

### ActivityWatch in the background

The ActivityWatch that comes with FocusGarden appears as an icon in the system tray on Windows (near the clock) or the menu bar on macOS. It keeps tracking after you close FocusGarden, so a task you leave running still gets counted. To stop it, right-click (Windows) or click (macOS) the icon and choose **Quit**; it starts again the next time you sign in or open FocusGarden.

If you already had ActivityWatch installed and running, FocusGarden uses yours instead. If your own copy also starts at sign-in, turn off **Start ActivityWatch when I sign in** in FocusGarden so only one copy starts.

### Uninstall

- **Installer:** Windows Settings → **Apps** → **FocusGarden** → **Uninstall**. This also stops and removes the included ActivityWatch and its startup entry.
- **Zip:** open **Settings** and untick **Start ActivityWatch when I sign in**, quit ActivityWatch from its tray icon, then delete the folder.
- **macOS:** open **Settings** and untick **Start ActivityWatch when I sign in**, quit ActivityWatch from its menu bar icon, then drag FocusGarden from Applications to the Trash. (If you've already deleted it, remove `~/Library/LaunchAgents/com.focusgarden.activitywatch.plist`.)

Your garden and settings are kept in case you reinstall. To remove them too, use **Settings → Reset all data** before uninstalling, or delete the data folder listed under [Your data](#your-data). ActivityWatch keeps its own history in `%LOCALAPPDATA%\activitywatch` (Windows) or `~/Library/Application Support/activitywatch` (macOS); delete that folder too if you want it gone.

## Using FocusGarden

### Main page

The sky shows the **FocusGarden** window with a **Tasks** button. Clouds around the window carry the names of your five most recently completed tasks, and the strip of grass along the bottom is a preview of your garden.

- **Tasks** opens the Task page.
- **Click a cloud** to jump to the Task page with that task's results open.
- **Click the garden strip** to open the Garden page.
- **Settings** reopens the setup window (ActivityWatch status and your API key) and has **Reset all data**.

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
2. Click **Stop**. The gate swings open, the animal walks out of the pen, and the gate swings shut behind it (about 4 seconds in all).
3. FocusGarden analyses the session (this takes a few seconds). When it's done, a new cloud with the task's name appears in the sky.

Click **Close** (or press Esc) to dismiss the popup without stopping the task.

### Reviewing a task

Click any cloud on the Main or Task page to open that task's results:

- A **bar** showing the split between on-task (green), off-task (brown) and idle (grey) time.
- **What you did:** every app, website and search from the session, labelled **App**, **Website** or **Search**, with time spent (not counting idle time) and whether it counted as on-task or off-task, longest first.

### What counts as idle

You're **idle** once ActivityWatch sees no keyboard or mouse input for **3 minutes**. The whole stretch counts from your last input, so a 10-minute break is 10 idle minutes, and a 2-minute pause isn't idle at all.

Idle time is worked out on your computer and is never sent to Claude. It is taken out of whatever app or website was in front, so leaving a work app open while you're away doesn't grow your plant. On-task, off-task and idle together add up to the length of the session.

To change the 3 minutes, edit `timeout` (in seconds) in ActivityWatch's `aw-watcher-afk.toml`: on Windows, `%LOCALAPPDATA%\activitywatch\activitywatch\aw-watcher-afk\aw-watcher-afk.toml`. Remove the `#` in front of `timeout = 180`, change the number, then quit ActivityWatch from its tray icon and reopen FocusGarden.

### Websites and searches

Time in a web browser is split into the sites and searches you used, and the browser itself isn't listed, so nothing is counted twice:

- **With the ActivityWatch browser extension** (see [First launch](#first-launch)), each page appears with its site and title, such as `github.com — 13EN-L/startup-ideas: Pull request #2`, and is classified on its own. Searches on Google, Bing, DuckDuckGo, Brave, Ecosia, Yahoo and YouTube appear with what you searched for, such as `Google search: react hooks`.
- **Without it**, FocusGarden uses the browser window's page title, such as `Pull request #2 · org/repo`. Google, DuckDuckGo and Brave searches are still recognised from their titles.

Each site and search is classified on-task or off-task on its own, so an on-topic search counts toward your plant even if the next video doesn't.

The clouds only show your five newest tasks, but FocusGarden keeps every task you complete. To find an older one, open the Garden and click the plant for its category (see [Task history](#task-history)).

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

The clouds drifting across the Garden sky are decoration only: they carry no task names and can't be clicked.

### Task history

Click a plant in the Garden to see how it's doing and **every completed task in its category**. For example, clicking the Pine shows:

- **Focus time:** all the productive time that has gone into the plant.
- **Stage** (1 to 6), **Growth** (how far through its current 36-minute cycle, also shown as a bar) and the plant's **Prestige**.
- A sentence or two about the plant.
- All your Work tasks, newest first. Each row shows the task name, the date you finished it and its on-task time. The list scrolls when it gets long.

Click a task in the list to open its results (the same breakdown bar and **What you did:** list as a cloud). **Close** or Esc closes the results and returns you to the list; press it again to close the list.

### Closing and reopening

FocusGarden saves after every change. If you close it with tasks running, it reopens on the Task page with your animals still in the pen and their timers still counting from when you started. Otherwise it reopens on the page you left.

### Your data

Your garden (`focusgarden-state.json`) and settings (`settings.json`) live in one folder:

| OS | Folder |
|---|---|
| Windows | `%APPDATA%\FocusGarden` |
| macOS | `~/Library/Application Support/FocusGarden` |
| Linux | `~/.config/FocusGarden` |

`focusgarden-state.json` holds your running tasks and **every** task you've completed (not just the five shown as clouds), plus your plants' growth.

**Starting over.** Open **Settings** on the main page and click **Reset all data**, then **Yes, erase everything**. This erases all tasks, plants, prestige and trophies and can't be undone. Your saved API key is kept; use **Remove saved key** if you want that gone too. Deleting `focusgarden-state.json` while FocusGarden is closed does the same thing.

Your API key in `settings.json` is encrypted with your operating system's credential protection, so it only works for your user account on this computer.

## Privacy

- ActivityWatch data stays on your computer. FocusGarden reads it only for the time between starting and stopping a task.
- For each completed task, FocusGarden sends Claude the **task name, its category, and the list of app names, websites and searches** with time spent on each. Web pages are sent as their domain and **page title** (for example `github.com — 13EN-L/startup-ideas`) when the browser extension is installed, or as the page title alone without it. Searches are sent with the **words you searched for** (for example `Google search: react hooks`).
- It does **not** send full URLs, page contents, window titles of apps other than your browser, or idle time. Idle time is worked out on your computer.
- When you save an API key, FocusGarden makes one request to Anthropic to check that the key works.

## Troubleshooting

**"Could not analyze …" after stopping a task.** Usually ActivityWatch isn't running, or no API key is saved. Open **Settings** on the main page to see which, fix it, and run your next task as normal. The failed session's results aren't saved.

**Settings says ActivityWatch "couldn't be started" (Windows).** Click **Try again**. If it still fails, another program may be using port 5600, or security software may have blocked `aw-qt.exe` in FocusGarden's install folder.

**"Anthropic rejected this key."** The key was mistyped, revoked or belongs to a disabled account. Create a new key in the [Claude Console](https://console.anthropic.com/settings/keys) and paste it again.

**A browser shows up as one page title instead of the sites you visited.** Without the extension, FocusGarden only sees the tab that was showing in the browser window. Install the ActivityWatch browser extension (**Settings → Chrome / Edge extension** or **Firefox add-on**) for exact websites.

**Idle time looks too high or too low.** See [What counts as idle](#what-counts-as-idle) to change the 3-minute threshold.

**Opening FocusGarden again just brings up the existing window.** That's intentional: only one copy runs at a time so two windows can't overwrite each other's garden.

## Replacing the artwork

Animals, plants, clouds and trophies currently use transparent placeholder images, outlined with dashed boxes so you can see where art will go. To add real art, save PNGs over the files in `public/assets/`, then rebuild:

```
public/assets/
├── animals/<animal>.png              cow.png, horse.png, …
├── plants/<plant>/stage-1.png … stage-6.png
├── plants/<plant>/about.txt          the plant's description
├── clouds/cloud.png
└── trophies/bronze.png, silver.png, gold.png
```

`npm run assets:placeholders` recreates any missing placeholders and never overwrites real art.

**Plant descriptions** work the same way: edit the plain text in `public/assets/plants/<plant>/about.txt` (for example `pine/about.txt`), then rebuild. It appears above the task list when that plant is clicked in the Garden. Keep it to a sentence or two. If the file is missing or empty, the popup simply leaves the description out.

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

On Windows and macOS, run `npm run activitywatch:fetch` once so `npm run dev` can start the bundled ActivityWatch too. Without it, start ActivityWatch yourself. Starting ActivityWatch at sign-in is only set up by installed builds, so `npm run dev` and the tests never change your own startup items.

If the window opens blank when launched from an editor's terminal, the editor may be leaking `ELECTRON_RUN_AS_NODE=1` (VS Code does). Clear it first: `Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell, `unset ELECTRON_RUN_AS_NODE` in bash.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app with hot reload |
| `npm run build` | Builds the app into `dist/` and `dist-electron/` |
| `npm start` | Opens the built app |
| `npm run dist:win` | Downloads ActivityWatch, then builds the Windows installer and zip into `release/` |
| `npm run activitywatch:fetch` | Downloads the bundled ActivityWatch for this computer into `vendor/` (checksum-verified; on a Mac, both Apple silicon and Intel) |
| `npm run dist:mac` | Downloads ActivityWatch, then builds `FocusGarden-<version>-macOS-arm64.dmg` and `-x64.dmg` into `release/` (must run on a Mac) |
| `npm run dist:linux` | Builds the Linux AppImage |
| `npm test` | Unit, integration and property-based tests |
| `npm run test:e2e` | Builds, then drives the real app with Playwright, using fake ActivityWatch and Claude services |
| `npm run test:mutation` | Mutation testing with Stryker (requires the other tests to pass) |
| `npm run typecheck` | TypeScript checks for the app and tests |

### Publishing a release

1. Bump `version` in `package.json`.
2. Run `npm run dist:win` on Windows, `npm run dist:mac` on a Mac, and `npm run dist:linux` on Linux. Each writes its files to `release/`. Instead of a Mac, you can use the `.dmg` files from the **macOS** GitHub Actions workflow (below).
3. Create a GitHub release and attach `FocusGarden-<version>-Windows-Setup.exe`, `FocusGarden-<version>-Windows.zip`, `FocusGarden-<version>-macOS-arm64.dmg`, `FocusGarden-<version>-macOS-x64.dmg` and `FocusGarden-<version>-Linux.AppImage`.

Packaging is configured in [electron-builder.yml](electron-builder.yml). The builds are unsigned; signing with a Windows code-signing certificate and an Apple Developer ID would remove the SmartScreen and Gatekeeper warnings described above.

The Windows build bundles ActivityWatch's official portable release, and the macOS builds bundle the `ActivityWatch.app` from its official `.dmg` (one per CPU architecture, unmodified so its signature stays valid). Versions and SHA-256 checksums are pinned in [scripts/fetch-activitywatch.mjs](scripts/fetch-activitywatch.mjs); to upgrade, change them there. [build/installer.nsh](build/installer.nsh) stops the bundled copy before FocusGarden is upgraded or uninstalled, and removes its startup entry on uninstall.

### Checking the Mac build

[.github/workflows/macos.yml](.github/workflows/macos.yml) runs on every push on a GitHub-hosted Mac (Apple silicon). It runs all the tests, including the end-to-end suite against the real app, builds both `.dmg` files, checks that the bundled ActivityWatch is intact and actually starts, and checks the login item FocusGarden writes. Download the `.dmg` files from the run's **Artifacts**.

## Credits

FocusGarden's Windows and macOS builds include [ActivityWatch](https://activitywatch.net), redistributed unmodified under the [Mozilla Public License 2.0](https://github.com/ActivityWatch/activitywatch/blob/master/LICENSE.txt). Its licence and a link to its source code are installed alongside it in `resources\activitywatch\` (Windows) or `FocusGarden.app/Contents/Resources/activitywatch/` (macOS).

### Code layout

- `src/core/`: growth, prestige, task and save-file logic, with no Electron or UI dependencies.
- `src/main/`: the Electron main process, which talks to ActivityWatch, Claude, the save file and the settings file.
- `src/renderer/`: the React interface.

The full product rules are in [docs/product-spec.md](docs/product-spec.md) and [docs/design-tokens.md](docs/design-tokens.md), and contributor guidelines are in [CLAUDE.md](CLAUDE.md).
