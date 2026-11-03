import { describe, expect, it, vi } from 'vitest'
import { createActivityWatchLauncher, type LauncherDeps } from './launcher'

const BIN = '/app/resources/activitywatch'

function setup(
  options: {
    running?: boolean[]
    missing?: boolean
    platform?: NodeJS.Platform
    savedPids?: number[]
    stillOurs?: number[] // saved pids that are still ActivityWatch processes
  } = {}
): {
  deps: LauncherDeps
  spawned: string[]
  killed: string[]
  saved: number[][]
} {
  const spawned: string[] = []
  const killed: string[] = []
  const saved: number[][] = []
  let nextPid = 100
  // Each isServerRunning call returns the next value; the last one repeats.
  const answers = [...(options.running ?? [false, true])]
  const deps: LauncherDeps = {
    reader: {
      isServerRunning: vi.fn(async () => (answers.length > 1 ? answers.shift()! : answers[0]))
    },
    binDir: BIN,
    platform: options.platform ?? 'darwin',
    exists: () => !options.missing,
    spawn: vi.fn((command: string) => {
      spawned.push(command)
      return { pid: nextPid++, kill: () => void killed.push(command), unref: () => {} }
    }),
    adopt: (pid) =>
      options.stillOurs?.includes(pid)
        ? { pid, kill: () => void killed.push(`pid ${pid}`), unref: () => {} }
        : null,
    savedPids: {
      load: () => options.savedPids ?? [],
      save: (pids) => void saved.push(pids)
    },
    wait: async () => {},
    startTimeoutMs: 1000,
    pollMs: 250
  }
  return { deps, spawned, killed, saved }
}

const SERVER = `${BIN}/aw-server-rust/aw-server-rust`
const AFK = `${BIN}/aw-watcher-afk/aw-watcher-afk`
const WINDOW = `${BIN}/aw-watcher-window/aw-watcher-window`

describe('ActivityWatch launcher', () => {
  it('reuses a server that is already running and starts nothing', async () => {
    const { deps, spawned } = setup({ running: [true] })
    expect(await createActivityWatchLauncher(deps).ensureRunning()).toBe('reused')
    expect(spawned).toEqual([])
  })

  it('starts the server, waits for it, then starts both watchers', async () => {
    const { deps, spawned } = setup({ running: [false, false, false, true] })
    expect(await createActivityWatchLauncher(deps).ensureRunning()).toBe('started')
    expect(spawned).toEqual([SERVER, AFK, WINDOW])
    expect(deps.reader.isServerRunning).toHaveBeenCalledTimes(4)
  })

  it('gives up when the server never answers, without starting watchers', async () => {
    const { deps, spawned, killed } = setup({ running: [false] })
    expect(await createActivityWatchLauncher(deps).ensureRunning()).toBe('unavailable')
    expect(spawned).toEqual([SERVER])
    expect(killed).toEqual([SERVER])
  })

  it('is unavailable when the bundled binaries are missing', async () => {
    const { deps, spawned } = setup({ missing: true })
    expect(await createActivityWatchLauncher(deps).ensureRunning()).toBe('unavailable')
    expect(spawned).toEqual([])
  })

  it('uses .exe names on Windows', async () => {
    const { deps, spawned } = setup({ platform: 'win32' })
    await createActivityWatchLauncher(deps).ensureRunning()
    expect(spawned).toEqual([`${SERVER}.exe`, `${AFK}.exe`, `${WINDOW}.exe`])
  })

  it('starts ActivityWatch only once when asked twice at the same time', async () => {
    const { deps, spawned } = setup()
    const launcher = createActivityWatchLauncher(deps)
    await Promise.all([launcher.ensureRunning(), launcher.ensureRunning()])
    expect(spawned).toHaveLength(3)
  })

  it('does nothing when asked again while ActivityWatch is still running', async () => {
    const { deps, spawned } = setup({ running: [false, true] })
    const launcher = createActivityWatchLauncher(deps)
    await launcher.ensureRunning()
    expect(await launcher.ensureRunning()).toBe('reused')
    expect(spawned).toHaveLength(3)
  })

  it('restarts ActivityWatch if it stopped while the app was open, clearing out the old parts', async () => {
    // started, then answering, then found stopped, then answering again
    const { deps, spawned, killed } = setup({ running: [false, true, false, true] })
    const launcher = createActivityWatchLauncher(deps)
    await launcher.ensureRunning()
    expect(await launcher.ensureRunning()).toBe('started')
    expect(spawned).toEqual([SERVER, AFK, WINDOW, SERVER, AFK, WINDOW])
    expect(killed.sort()).toEqual([AFK, SERVER, WINDOW].sort())

    launcher.stopIfIdle(false)
    expect(killed).toHaveLength(6)
  })

  it('stops what it started when no tasks are active', async () => {
    const { deps, killed } = setup()
    const launcher = createActivityWatchLauncher(deps)
    await launcher.ensureRunning()
    launcher.stopIfIdle(false)
    expect(killed.sort()).toEqual([AFK, SERVER, WINDOW].sort())
  })

  it('keeps ActivityWatch running while tasks are active, and remembers its processes', async () => {
    const { deps, killed, saved } = setup()
    const launcher = createActivityWatchLauncher(deps)
    await launcher.ensureRunning()
    launcher.stopIfIdle(true)
    expect(killed).toEqual([])
    expect(saved).toEqual([[100, 101, 102]])
  })

  it('forgets its processes once it has stopped them', async () => {
    const { deps, saved } = setup()
    const launcher = createActivityWatchLauncher(deps)
    await launcher.ensureRunning()
    launcher.stopIfIdle(false)
    expect(saved).toEqual([[]])
  })

  it('takes back the ActivityWatch it left running last time, and stops it when idle', async () => {
    const { deps, spawned, killed, saved } = setup({
      running: [true],
      savedPids: [100, 101, 102],
      stillOurs: [100, 101, 102]
    })
    const launcher = createActivityWatchLauncher(deps)
    expect(await launcher.ensureRunning()).toBe('reused')
    expect(spawned).toEqual([])
    launcher.stopIfIdle(false)
    expect(killed).toEqual(['pid 100', 'pid 101', 'pid 102'])
    expect(saved).toEqual([[]])
  })

  it('keeps remembering taken-back processes while tasks are still active', async () => {
    const { deps, killed, saved } = setup({
      running: [true],
      savedPids: [100, 101, 102],
      stillOurs: [100, 101, 102]
    })
    const launcher = createActivityWatchLauncher(deps)
    await launcher.ensureRunning()
    launcher.stopIfIdle(true)
    expect(killed).toEqual([])
    expect(saved).toEqual([[100, 101, 102]])
  })

  it('ignores saved process ids that are no longer ActivityWatch', async () => {
    const { deps, killed, saved } = setup({
      running: [true],
      savedPids: [100, 101, 102],
      stillOurs: [101]
    })
    const launcher = createActivityWatchLauncher(deps)
    await launcher.ensureRunning()
    launcher.stopIfIdle(false)
    expect(killed).toEqual(['pid 101'])
    expect(saved).toEqual([[]])
  })

  it('forgets saved processes when it has to start a fresh ActivityWatch', async () => {
    const { deps, killed } = setup({ savedPids: [7, 8], stillOurs: [7, 8] })
    const launcher = createActivityWatchLauncher(deps)
    expect(await launcher.ensureRunning()).toBe('started')
    launcher.stopIfIdle(false)
    expect(killed).not.toContain('pid 7')
  })

  it('never stops an ActivityWatch it did not start', async () => {
    const { deps, killed } = setup({ running: [true] })
    const launcher = createActivityWatchLauncher(deps)
    await launcher.ensureRunning()
    launcher.stopIfIdle(false)
    expect(killed).toEqual([])
  })

  it('starts processes detached so they can outlive the app', async () => {
    const { deps } = setup()
    await createActivityWatchLauncher(deps).ensureRunning()
    expect(deps.spawn).toHaveBeenCalledWith(SERVER, [])
  })
})
