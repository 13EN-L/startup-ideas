import { describe, expect, it } from 'vitest'
import { applyGrowth } from './growth'

const s = (start: number, end: number): { start: number; end: number } => ({
  start: start * 1000,
  end: end * 1000
})

describe('applyGrowth', () => {
  it('creates the plant on the first task, even with no productive time', () => {
    expect(
      applyGrowth({ plantTotalSeconds: null, creditedIntervals: [], productiveIntervals: [] })
    ).toEqual({ plantTotalSeconds: 0, addedSeconds: 0, creditedIntervals: [], created: true })
  })

  it('creates the plant with the first task’s productive time', () => {
    const grown = applyGrowth({
      plantTotalSeconds: null,
      creditedIntervals: [],
      productiveIntervals: [s(0, 90)]
    })
    expect(grown).toEqual({
      plantTotalSeconds: 90,
      addedSeconds: 90,
      creditedIntervals: [s(0, 90)],
      created: true
    })
  })

  it('adds to an existing plant without marking it created', () => {
    const grown = applyGrowth({
      plantTotalSeconds: 100,
      creditedIntervals: [s(0, 100)],
      productiveIntervals: [s(200, 250)]
    })
    expect(grown).toEqual({
      plantTotalSeconds: 150,
      addedSeconds: 50,
      creditedIntervals: [s(0, 100), s(200, 250)],
      created: false
    })
  })

  it('only adds the part of a same-category overlap not already credited', () => {
    const grown = applyGrowth({
      plantTotalSeconds: 60,
      creditedIntervals: [s(0, 60)],
      productiveIntervals: [s(30, 90)]
    })
    expect(grown.addedSeconds).toBe(30)
    expect(grown.plantTotalSeconds).toBe(90)
    expect(grown.creditedIntervals).toEqual([s(0, 90)])
  })

  it('counts overlapping productive intervals within one task once', () => {
    const grown = applyGrowth({
      plantTotalSeconds: 0,
      creditedIntervals: [],
      productiveIntervals: [s(0, 60), s(30, 90)]
    })
    expect(grown.addedSeconds).toBe(90)
  })

  it('can wrap a plant more than once in one task', () => {
    const grown = applyGrowth({
      plantTotalSeconds: 0,
      creditedIntervals: [],
      productiveIntervals: [s(0, 3 * 2160 + 10)]
    })
    expect(grown.plantTotalSeconds).toBe(3 * 2160 + 10)
  })

  it('rejects a negative or non-finite plant total', () => {
    const base = { creditedIntervals: [], productiveIntervals: [] }
    expect(() => applyGrowth({ ...base, plantTotalSeconds: -1 })).toThrow(RangeError)
    expect(() => applyGrowth({ ...base, plantTotalSeconds: -1 })).toThrow('Invalid plant total: -1')
    expect(() => applyGrowth({ ...base, plantTotalSeconds: Number.NaN })).toThrow(RangeError)
  })
})
