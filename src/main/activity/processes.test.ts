import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { adoptProcess, createPidFile, launchCommand } from './processes'

describe('launchCommand', () => {
  it('runs each part under a shell that waits for it, so the part never loses its parent', () => {
    expect(
      launchCommand('/app/aw-watcher-afk/aw-watcher-afk', ['--port', '5600'], 'darwin')
    ).toEqual({
      file: '/bin/sh',
      args: ['-c', '"$0" "$@"; exit $?', '/app/aw-watcher-afk/aw-watcher-afk', '--port', '5600']
    })
  })

  it('uses cmd.exe on Windows', () => {
    expect(launchCommand('C:\\FG\\aw-watcher-afk.exe', [], 'win32')).toEqual({
      file: 'cmd.exe',
      args: ['/d', '/c', 'C:\\FG\\aw-watcher-afk.exe']
    })
  })
})

describe('createPidFile', () => {
  const dirs: string[] = []
  afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))
  const file = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'focusgarden-pids-'))
    dirs.push(dir)
    return join(dir, 'activitywatch-pids.json')
  }

  it('is empty when nothing was saved', () => {
    expect(createPidFile(file()).load()).toEqual([])
  })

  it('round-trips saved pids', () => {
    const pids = createPidFile(file())
    pids.save([12, 34])
    expect(pids.load()).toEqual([12, 34])
    pids.save([])
    expect(pids.load()).toEqual([])
  })

  it('ignores a damaged file', () => {
    const path = file()
    writeFileSync(path, 'not json')
    expect(createPidFile(path).load()).toEqual([])
    writeFileSync(path, '[1, "two", -3, 4.5, 5]')
    expect(createPidFile(path).load()).toEqual([1, 5])
  })
})

describe('adoptProcess', () => {
  it('refuses a process that is not one of the bundled ActivityWatch parts', () => {
    expect(adoptProcess(process.pid, '/nowhere/activitywatch')).toBeNull()
  })

  it('refuses a pid that no longer exists', () => {
    expect(adoptProcess(2 ** 22 + 12345, '/nowhere/activitywatch')).toBeNull()
  })
})
