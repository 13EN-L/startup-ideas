// One test per worked example in docs/rewards.md. If an example changes there, change it here.
import { describe, expect, it } from 'vitest'
import { applyGrowth, computeBuckets, globalPrestige, plantState, trophiesFor } from './index'

const T0 = Date.UTC(2026, 10, 2, 14, 0) // 2:00 PM UTC
const at = (minutes: number): number => T0 + minutes * 60_000
const span = (fromMin: number, toMin: number): { start: number; end: number } => ({
  start: at(fromMin),
  end: at(toMin)
})

describe('docs/rewards.md worked examples', () => {
  it('from the spec (no wrap): 0 + 20 min is stage 4, scaled for 2 min', () => {
    const grown = applyGrowth({
      plantTotalSeconds: 0,
      creditedIntervals: [],
      productiveIntervals: [span(0, 20)]
    })
    const state = plantState(grown.plantTotalSeconds)
    expect(state.stage).toBe(4)
    expect(state.prestige).toBe(0)
    expect(state.scale).toBeCloseTo(1 + 0.1 * (2 / 6))
  })

  it('from the spec (wrap): 35 min into a cycle at prestige 1, + 10 min', () => {
    const start = 36 * 60 + 35 * 60
    expect(plantState(start)).toMatchObject({ prestige: 1, stage: 6 })

    const grown = applyGrowth({
      plantTotalSeconds: start,
      creditedIntervals: [],
      productiveIntervals: [span(0, 10)]
    })
    const state = plantState(grown.plantTotalSeconds)
    expect(state.prestige).toBe(2)
    expect(state.stage).toBe(2)
    expect(state.scale).toBeCloseTo(1.05)
  })

  it('first task in a category: 0 productive min creates the plant at stage 1', () => {
    const grown = applyGrowth({
      plantTotalSeconds: null,
      creditedIntervals: [],
      productiveIntervals: []
    })
    expect(grown.created).toBe(true)
    expect(grown.plantTotalSeconds).toBe(0)
    expect(plantState(grown.plantTotalSeconds)).toEqual({
      prestige: 0,
      stage: 1,
      progress: 0,
      scale: 1
    })
  })

  it('idle and off-task time: 40-min task adds only the 25 on-task min', () => {
    const buckets = computeBuckets({
      items: [
        { label: 'on-task', intervals: [span(0, 25)] },
        { label: 'off-task', intervals: [span(25, 30)] }
      ],
      idleIntervals: [span(30, 40)]
    })
    expect(buckets.productiveSeconds).toBe(25 * 60)
    expect(buckets.unproductiveSeconds).toBe(5 * 60)
    expect(buckets.idleSeconds).toBe(10 * 60)

    const grown = applyGrowth({
      plantTotalSeconds: 0,
      creditedIntervals: [],
      productiveIntervals: buckets.productiveIntervals
    })
    expect(grown.addedSeconds).toBe(25 * 60)
  })

  it('partial minutes: 5 min 40 s + 20 s is the start of stage 2', () => {
    const grown = applyGrowth({
      plantTotalSeconds: 5 * 60 + 40,
      creditedIntervals: [],
      productiveIntervals: [{ start: T0, end: T0 + 20_000 }]
    })
    expect(plantState(grown.plantTotalSeconds)).toMatchObject({ stage: 2, progress: 0, scale: 1 })
  })

  it('overlap, different categories: Work and Study 2:00-2:30 each get +30 min', () => {
    const work = applyGrowth({
      plantTotalSeconds: 0,
      creditedIntervals: [],
      productiveIntervals: [span(0, 30)]
    })
    const study = applyGrowth({
      plantTotalSeconds: 0,
      creditedIntervals: [],
      productiveIntervals: [span(0, 30)]
    })
    expect(work.addedSeconds).toBe(30 * 60)
    expect(study.addedSeconds).toBe(30 * 60)
  })

  it('overlap, same category: two Work tasks 2:00-2:30 give Pine +30 min, not 60', () => {
    const first = applyGrowth({
      plantTotalSeconds: 0,
      creditedIntervals: [],
      productiveIntervals: [span(0, 30)]
    })
    const second = applyGrowth({
      plantTotalSeconds: first.plantTotalSeconds,
      creditedIntervals: first.creditedIntervals,
      productiveIntervals: [span(0, 30)]
    })
    expect(second.addedSeconds).toBe(0)
    expect(second.plantTotalSeconds).toBe(30 * 60)
  })

  it('trophy: prestige 4 + 3 + 2 = 9 is bronze only; the next wrap adds silver', () => {
    const cycle = 36 * 60
    const totals = [4 * cycle, 3 * cycle, 2 * cycle + 35 * 60]
    expect(globalPrestige(totals)).toBe(9)
    expect(trophiesFor(globalPrestige(totals))).toEqual(['bronze'])

    totals[2] += 60
    expect(globalPrestige(totals)).toBe(10)
    expect(trophiesFor(globalPrestige(totals))).toEqual(['bronze', 'silver'])
  })
})
