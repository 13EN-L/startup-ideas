// Node process helpers for the bundled ActivityWatch (used by launcher.ts via src/main/index.ts).
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { ChildLike } from './launcher'

// Stops a process and everything it started. Parts run in their own process group (detached).
function killTree(pid: number): void {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      process.kill(-pid, 'SIGTERM')
    }
  } catch {
    // already exited
  }
}

// aw-watcher-afk quits as soon as its parent process exits (ActivityWatch's own tray app is
// normally that parent). So each part runs under a small shell that waits for it: the shell is
// detached and outlives the app, and stopping the process group stops both.
export function launchCommand(
  command: string,
  args: string[],
  platform: NodeJS.Platform = process.platform
): { file: string; args: string[] } {
  if (platform === 'win32') return { file: 'cmd.exe', args: ['/d', '/c', command, ...args] }
  return { file: '/bin/sh', args: ['-c', '"$0" "$@"; exit $?', command, ...args] }
}

// Starts an ActivityWatch part detached, so it can outlive the app.
export function startDetached(command: string, args: string[]): ChildLike {
  const launch = launchCommand(command, args)
  const child = spawn(launch.file, launch.args, { detached: true, stdio: 'ignore' })
  child.on('error', (error) => console.warn(`Could not start ${command}:`, error.message))
  return {
    pid: child.pid,
    unref: () => child.unref(),
    kill: () => child.pid !== undefined && killTree(child.pid)
  }
}

// The command line of a running process, or null if it isn't running.
function commandOf(pid: number): string | null {
  try {
    if (process.platform === 'win32') {
      const line = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`
        ],
        { encoding: 'utf8' }
      ).trim()
      return line || null
    }
    return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

// Takes back a process this app left running, but only if that pid is still the launcher shell
// of a bundled ActivityWatch part (pids get reused, e.g. after a restart).
export function adoptProcess(pid: number, binDir: string): ChildLike | null {
  const command = commandOf(pid)
  return command?.includes(binDir) ? { pid, unref: () => {}, kill: () => killTree(pid) } : null
}

// Where the app remembers the ActivityWatch processes it left running for active tasks.
export function createPidFile(path: string): { load(): number[]; save(pids: number[]): void } {
  return {
    load() {
      if (!existsSync(path)) return []
      try {
        const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
        return Array.isArray(value)
          ? value.filter((pid): pid is number => Number.isInteger(pid) && pid > 0)
          : []
      } catch {
        return []
      }
    },
    save(pids) {
      writeFileSync(path, JSON.stringify(pids))
    }
  }
}
