import { join } from 'node:path'
import type { ActivityReader } from '../../shared/activity'

// The 3 ActivityWatch parts FocusGarden bundles (see scripts/fetch-activitywatch.mjs).
const SERVER = 'aw-server-rust'
const WATCHERS = ['aw-watcher-afk', 'aw-watcher-window'] as const

export interface ChildLike {
  pid?: number
  kill(): void
  unref(): void
}

export interface LauncherDeps {
  reader: Pick<ActivityReader, 'isServerRunning'>
  binDir: string
  platform: NodeJS.Platform
  exists: (path: string) => boolean
  // Must start the process detached, so it can keep running after the app quits.
  spawn: (command: string, args: string[]) => ChildLike
  // Wraps a saved pid, or returns null if that process is gone or no longer ActivityWatch.
  adopt: (pid: number) => ChildLike | null
  // Pids of the ActivityWatch processes this app left running for active tasks.
  savedPids: { load(): number[]; save(pids: number[]): void }
  wait?: (ms: number) => Promise<void>
  startTimeoutMs?: number
  pollMs?: number
}

export type LaunchResult = 'reused' | 'started' | 'unavailable'

export interface ActivityWatchLauncher {
  // Reuses a running ActivityWatch (the user's own, or ours from a previous session), or
  // starts the bundled one. Safe to call often: it's cheap while the server answers, and it
  // restarts ActivityWatch if it stopped while the app was open.
  ensureRunning(): Promise<LaunchResult>
  // On quit: stops the ActivityWatch this app started (now or in an earlier session), unless
  // tasks are active. Then it keeps recording while the app is closed, and the next launch
  // takes it back.
  stopIfIdle(hasActiveTasks: boolean): void
}

export function createActivityWatchLauncher(deps: LauncherDeps): ActivityWatchLauncher {
  const { reader, binDir, platform, exists, spawn, adopt, savedPids } = deps
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const startTimeoutMs = deps.startTimeoutMs ?? 15_000
  const pollMs = deps.pollMs ?? 250
  const started: ChildLike[] = []
  let launch: Promise<LaunchResult> | undefined
  let checkedSaved = false

  const binary = (name: string): string =>
    join(binDir, name, platform === 'win32' ? `${name}.exe` : name)

  function start(name: string): ChildLike {
    const child = spawn(binary(name), [])
    child.unref()
    started.push(child)
    return child
  }

  async function serverAnswers(): Promise<boolean> {
    for (let waited = 0; waited < startTimeoutMs; waited += pollMs) {
      if (await reader.isServerRunning()) return true
      await wait(pollMs)
    }
    return reader.isServerRunning()
  }

  async function run(): Promise<LaunchResult> {
    const running = await reader.isServerRunning()
    // Processes left running by an earlier session only matter if that server still answers.
    if (!checkedSaved) {
      checkedSaved = true
      if (running) {
        for (const pid of savedPids.load()) {
          const child = adopt(pid)
          if (child) started.push(child)
        }
      }
    }
    if (running) return 'reused'
    if (![SERVER, ...WATCHERS].every((name) => exists(binary(name)))) return 'unavailable'

    // The server stopped while the app was open: clear out whatever is left of our parts
    // before starting fresh ones.
    started.splice(0).forEach((child) => child.kill())

    const server = start(SERVER)
    if (!(await serverAnswers())) {
      server.kill()
      started.length = 0
      return 'unavailable'
    }
    WATCHERS.forEach(start)
    return 'started'
  }

  return {
    ensureRunning() {
      launch ??= run().finally(() => {
        launch = undefined
      })
      return launch
    },
    stopIfIdle(hasActiveTasks) {
      if (hasActiveTasks) {
        savedPids.save(started.flatMap((child) => (child.pid === undefined ? [] : [child.pid])))
        return
      }
      started.splice(0).forEach((child) => child.kill())
      savedPids.save([])
    }
  }
}
