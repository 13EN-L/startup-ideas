// A span of time in UTC epoch milliseconds, end exclusive.
export interface Interval {
  start: number
  end: number
}

function assertValid(interval: Interval): void {
  const { start, end } = interval
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new RangeError(`Invalid interval: ${start} to ${end}`)
  }
}

// Sorted, non-overlapping copy of the input. Overlapping or touching spans are joined so
// each millisecond appears once; zero-length spans are dropped.
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  intervals.forEach(assertValid)
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start)

  const merged: Interval[] = []
  for (const { start, end } of sorted) {
    const last = merged[merged.length - 1]
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end)
    } else {
      merged.push({ start, end })
    }
  }
  return merged
}

// The parts of `from` not covered by `remove`.
export function subtractIntervals(
  from: readonly Interval[],
  remove: readonly Interval[]
): Interval[] {
  const cuts = mergeIntervals(remove)
  const result: Interval[] = []

  for (const { start, end } of mergeIntervals(from)) {
    let cursor = start
    for (const cut of cuts) {
      if (cut.end <= cursor) continue
      if (cut.start >= end) break
      if (cut.start > cursor) result.push({ start: cursor, end: cut.start })
      cursor = cut.end
    }
    if (cursor < end) result.push({ start: cursor, end })
  }
  return result
}

export function totalSeconds(intervals: readonly Interval[]): number {
  const ms = mergeIntervals(intervals).reduce((sum, i) => sum + (i.end - i.start), 0)
  return ms / 1000
}
