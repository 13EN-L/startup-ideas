import type { Label } from '../../shared/domain'
import { type Interval, mergeIntervals, subtractIntervals, totalSeconds } from './intervals'

export type { Label }

export interface LabeledItem {
  label: Label
  intervals: readonly Interval[]
}

export interface Buckets {
  productiveSeconds: number
  unproductiveSeconds: number
  idleSeconds: number
  productiveIntervals: Interval[]
}

// Splits a task's time into productive, unproductive, and idle. Idle wins over any
// label, so every second lands in exactly one bucket.
export function computeBuckets(input: {
  items: readonly LabeledItem[]
  idleIntervals: readonly Interval[]
}): Buckets {
  const idle = mergeIntervals(input.idleIntervals)
  const labeled = (label: Label): Interval[] =>
    subtractIntervals(
      input.items.filter((item) => item.label === label).flatMap((item) => item.intervals),
      idle
    )
  const onTask = labeled('on-task')
  const offTask = labeled('off-task')

  // The activity summary assigns each second to one item, so a span labeled both ways
  // means bad input. Fail rather than guess which label wins.
  if (totalSeconds(subtractIntervals(onTask, offTask)) !== totalSeconds(onTask)) {
    throw new RangeError('The same time is labeled both on-task and off-task')
  }

  return {
    productiveSeconds: totalSeconds(onTask),
    unproductiveSeconds: totalSeconds(offTask),
    idleSeconds: totalSeconds(idle),
    productiveIntervals: onTask
  }
}
