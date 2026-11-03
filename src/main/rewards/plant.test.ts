import { describe, expect, it } from 'vitest'
import { plantState } from './plant'

describe('plantState', () => {
  it('starts at stage 1, full size, no prestige', () => {
    expect(plantState(0)).toEqual({ prestige: 0, stage: 1, progress: 0, scale: 1 })
  })

  it('scales up linearly within a stage', () => {
    const state = plantState(180)
    expect(state.stage).toBe(1)
    expect(state.progress).toBeCloseTo(0.5)
    expect(state.scale).toBeCloseTo(1.05)
  })

  it('is almost 110% just before a stage boundary', () => {
    const state = plantState(359)
    expect(state.stage).toBe(1)
    expect(state.scale).toBeCloseTo(1 + 0.1 * (359 / 360))
  })

  it('switches stage and returns to 100% at each 6-minute mark', () => {
    for (let stage = 2; stage <= 6; stage++) {
      expect(plantState((stage - 1) * 360)).toEqual({ prestige: 0, stage, progress: 0, scale: 1 })
    }
  })

  it('moves a second past a boundary', () => {
    const state = plantState(361)
    expect(state.stage).toBe(2)
    expect(state.progress).toBeCloseTo(1 / 360)
  })

  it('is stage 6 just before the cycle ends', () => {
    expect(plantState(2159)).toMatchObject({ prestige: 0, stage: 6 })
  })

  it('wraps to stage 1 and adds prestige at 36 minutes', () => {
    expect(plantState(2160)).toEqual({ prestige: 1, stage: 1, progress: 0, scale: 1 })
  })

  it('carries leftover time into the next cycle', () => {
    expect(plantState(2160 + 400)).toMatchObject({ prestige: 1, stage: 2 })
  })

  it('counts many full cycles', () => {
    expect(plantState(100 * 2160 + 5 * 360)).toMatchObject({ prestige: 100, stage: 6 })
  })

  it('keeps partial seconds', () => {
    expect(plantState(359.5).stage).toBe(1)
    expect(plantState(360.5).stage).toBe(2)
  })

  it('rejects negative or non-finite totals', () => {
    expect(() => plantState(-1)).toThrow(RangeError)
    expect(() => plantState(-1)).toThrow('Invalid plant total: -1')
    expect(() => plantState(Number.NaN)).toThrow(RangeError)
    expect(() => plantState(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
