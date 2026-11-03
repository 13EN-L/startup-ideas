import type { TaskResults } from '../../shared/api'

const pad = (n: number): string => String(n).padStart(2, '0')

// 45s, 12m 30s, 1h 05m
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) return `${hours}h ${pad(minutes)}m`
  if (minutes > 0) return `${minutes}m ${pad(secs)}s`
  return `${secs}s`
}

// 5:53, rounding down so a stage never reads as complete before it is.
export function formatClock(seconds: number): string {
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${pad(total % 60)}`
}

// Whole percentages that always add up to 100 (largest remainder; ties go to the earlier one).
function wholePercents(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0)
  if (total === 0) return values.map(() => 0)
  const raw = values.map((v) => (v / total) * 100)
  const result = raw.map(Math.floor)
  const order = raw
    .map((r, i) => ({ i, fraction: r - Math.floor(r) }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i)
  for (let k = 0; k < 100 - result.reduce((s, v) => s + v, 0); k++) result[order[k].i]++
  return result
}

export interface Percentages {
  onTask: number | null // null while labels are pending
  offTask: number | null
  idle: number
  pending: boolean
}

// While pending, the non-idle share comes from the item list, which is known before labels are.
export function percentages(
  results: Pick<TaskResults, 'buckets'> & {
    items: { seconds: number }[]
  }
): Percentages {
  const { productiveSeconds, unproductiveSeconds, idleSeconds } = results.buckets
  if (productiveSeconds === null || unproductiveSeconds === null) {
    const active = results.items.reduce((sum, item) => sum + item.seconds, 0)
    const [, idle] = wholePercents([active, idleSeconds])
    return { onTask: null, offTask: null, idle, pending: true }
  }
  const [onTask, offTask, idle] = wholePercents([
    productiveSeconds,
    unproductiveSeconds,
    idleSeconds
  ])
  return { onTask, offTask, idle, pending: false }
}
