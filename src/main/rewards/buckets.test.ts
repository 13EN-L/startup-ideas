import { describe, expect, it } from 'vitest'
import { computeBuckets } from './buckets'

const s = (start: number, end: number): { start: number; end: number } => ({
  start: start * 1000,
  end: end * 1000
})

describe('computeBuckets', () => {
  it('is all zero for an empty task', () => {
    expect(computeBuckets({ items: [], idleIntervals: [] })).toEqual({
      productiveSeconds: 0,
      unproductiveSeconds: 0,
      idleSeconds: 0,
      productiveIntervals: []
    })
  })

  it('sums several on-task and off-task items', () => {
    const buckets = computeBuckets({
      items: [
        { label: 'on-task', intervals: [s(0, 10)] },
        { label: 'on-task', intervals: [s(20, 30)] },
        { label: 'off-task', intervals: [s(10, 15), s(40, 50)] }
      ],
      idleIntervals: []
    })
    expect(buckets.productiveSeconds).toBe(20)
    expect(buckets.unproductiveSeconds).toBe(15)
    expect(buckets.productiveIntervals).toEqual([s(0, 10), s(20, 30)])
  })

  it('never counts idle time as productive or unproductive', () => {
    const buckets = computeBuckets({
      items: [
        { label: 'on-task', intervals: [s(0, 60)] },
        { label: 'off-task', intervals: [s(60, 120)] }
      ],
      idleIntervals: [s(50, 70)]
    })
    expect(buckets.productiveSeconds).toBe(50)
    expect(buckets.unproductiveSeconds).toBe(50)
    expect(buckets.idleSeconds).toBe(20)
    expect(buckets.productiveIntervals).toEqual([s(0, 50)])
  })

  it('counts overlapping events of the same label once', () => {
    const buckets = computeBuckets({
      items: [
        { label: 'on-task', intervals: [s(0, 30)] },
        { label: 'on-task', intervals: [s(20, 40)] }
      ],
      idleIntervals: [s(100, 110), s(105, 120)]
    })
    expect(buckets.productiveSeconds).toBe(40)
    expect(buckets.idleSeconds).toBe(20)
  })

  it('rejects the same second labeled both on-task and off-task', () => {
    const conflicting = (): unknown =>
      computeBuckets({
        items: [
          { label: 'on-task', intervals: [s(0, 30)] },
          { label: 'off-task', intervals: [s(20, 40)] }
        ],
        idleIntervals: []
      })
    expect(conflicting).toThrow(RangeError)
    expect(conflicting).toThrow('labeled both on-task and off-task')
  })

  it('allows an on/off overlap when that span is idle', () => {
    const buckets = computeBuckets({
      items: [
        { label: 'on-task', intervals: [s(0, 30)] },
        { label: 'off-task', intervals: [s(20, 40)] }
      ],
      idleIntervals: [s(20, 30)]
    })
    expect(buckets.productiveSeconds).toBe(20)
    expect(buckets.unproductiveSeconds).toBe(10)
    expect(buckets.idleSeconds).toBe(10)
  })
})
