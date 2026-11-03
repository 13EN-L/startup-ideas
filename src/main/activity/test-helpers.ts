import type { Interval } from '../../shared/domain'
import type { AfkEvent, WebEvent, WindowEvent } from './summary'

// Fixtures are seconds after 09:00 UTC on 2 Nov 2026, the way ActivityWatch reports them.
export const BASE = Date.UTC(2026, 10, 2, 9, 0, 0)

export const at = (seconds: number): number => BASE + seconds * 1000

export const span = (start: number, end: number): Interval => ({ start: at(start), end: at(end) })

const timestamp = (seconds: number): string => new Date(at(seconds)).toISOString()

// On macOS the window watcher also reports the front tab's URL for Safari and Chromium browsers.
export function win(
  app: string,
  title: string,
  start: number,
  duration: number,
  url?: string
): WindowEvent {
  const data = url === undefined ? { app, title } : { app, title, url }
  return { timestamp: timestamp(start), duration, data }
}

export function afk(status: 'afk' | 'not-afk', start: number, duration: number): AfkEvent {
  return { timestamp: timestamp(start), duration, data: { status } }
}

export function web(url: string, title: string, start: number, duration: number): WebEvent {
  // The web watcher sends these extra fields too; the summary ignores them.
  const data = { url, title, audible: false, incognito: false, tabCount: 4 }
  return { timestamp: timestamp(start), duration, data }
}
