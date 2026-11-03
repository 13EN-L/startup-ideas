import { type Interval, mergeIntervals, subtractIntervals, totalSeconds } from './intervals'

export interface GrowthResult {
  plantTotalSeconds: number
  addedSeconds: number
  creditedIntervals: Interval[]
  created: boolean
}

// Applies one completed task's productive time to its category's plant. Time already
// credited to this category by another task isn't counted again. A null total means the
// plant doesn't exist yet: this task creates it, even if it adds nothing.
export function applyGrowth(input: {
  plantTotalSeconds: number | null
  creditedIntervals: readonly Interval[]
  productiveIntervals: readonly Interval[]
}): GrowthResult {
  const previous = input.plantTotalSeconds
  if (previous !== null && (!Number.isFinite(previous) || previous < 0)) {
    throw new RangeError(`Invalid plant total: ${previous}`)
  }

  const newTime = subtractIntervals(input.productiveIntervals, input.creditedIntervals)
  const addedSeconds = totalSeconds(newTime)

  return {
    plantTotalSeconds: (previous ?? 0) + addedSeconds,
    addedSeconds,
    creditedIntervals: mergeIntervals([...input.creditedIntervals, ...newTime]),
    created: previous === null
  }
}
