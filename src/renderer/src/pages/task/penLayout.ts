import { MAX_ACTIVE_TASKS } from '../../../../shared/domain'

// How long an animal takes to walk out through the gate (matches the CSS exit animation).
export const EXIT_MS = 1800

// Which task id sits in each of the pen's sections (null = free).
export type Sections = (number | null)[]

// Keeps every still-active (or still-exiting) task in its section and puts new tasks in the
// first free one, so animals never jump around when the list reloads.
export function assignSections(
  previous: Sections,
  activeIds: number[],
  exiting: ReadonlySet<number>
): Sections {
  const keep = new Set([...activeIds, ...exiting])
  const next: Sections = Array.from({ length: MAX_ACTIVE_TASKS }, (_, i) => {
    const id = previous[i] ?? null
    return id !== null && keep.has(id) ? id : null
  })
  for (const id of activeIds) {
    if (next.includes(id)) continue
    const free = next.indexOf(null)
    if (free === -1) break
    next[free] = id
  }
  return next
}

const pad = (n: number): string => String(n).padStart(2, '0')

// 0:12:05
export function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  return `${hours}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}
