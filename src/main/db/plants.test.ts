import { describe, expect, it } from 'vitest'
import {
  getCreditedIntervals,
  getPlant,
  listPlants,
  replaceCreditedIntervals,
  upsertPlantTotal
} from './plants'
import { freshDb, T0 } from './test-helpers'

describe('plants', () => {
  it('do not exist until created', () => {
    const db = freshDb()
    expect(getPlant(db, 'Work')).toBeUndefined()
    expect(listPlants(db)).toEqual([])
  })

  it('are listed in the order they first appeared', () => {
    const db = freshDb()
    upsertPlantTotal(db, 'Finance', 0)
    upsertPlantTotal(db, 'Work', 90)
    upsertPlantTotal(db, 'Creative', 10)
    upsertPlantTotal(db, 'Finance', 500)

    expect(listPlants(db)).toEqual([
      { category: 'Finance', totalSeconds: 500, position: 1 },
      { category: 'Work', totalSeconds: 90, position: 2 },
      { category: 'Creative', totalSeconds: 10, position: 3 }
    ])
  })

  it('keep partial seconds', () => {
    const db = freshDb()
    upsertPlantTotal(db, 'Home', 359.5)
    expect(getPlant(db, 'Home')?.totalSeconds).toBe(359.5)
  })

  it('reject negative totals and unknown categories', () => {
    const db = freshDb()
    expect(() => upsertPlantTotal(db, 'Home', -1)).toThrow()
    expect(() => upsertPlantTotal(db, 'Gaming' as never, 0)).toThrow()
  })
})

describe('credited intervals', () => {
  it('round-trip in time order', () => {
    const db = freshDb()
    upsertPlantTotal(db, 'Work', 0)
    const intervals = [
      { start: T0 + 5000, end: T0 + 6000 },
      { start: T0, end: T0 + 1000 }
    ]
    replaceCreditedIntervals(db, 'Work', intervals)
    expect(getCreditedIntervals(db, 'Work')).toEqual([intervals[1], intervals[0]])
  })

  it('replace the previous list', () => {
    const db = freshDb()
    upsertPlantTotal(db, 'Work', 0)
    replaceCreditedIntervals(db, 'Work', [{ start: T0, end: T0 + 1000 }])
    replaceCreditedIntervals(db, 'Work', [{ start: T0, end: T0 + 2000 }])
    expect(getCreditedIntervals(db, 'Work')).toEqual([{ start: T0, end: T0 + 2000 }])
  })

  it('stay separate per category', () => {
    const db = freshDb()
    upsertPlantTotal(db, 'Work', 0)
    upsertPlantTotal(db, 'School / Study', 0)
    replaceCreditedIntervals(db, 'Work', [{ start: T0, end: T0 + 1000 }])
    expect(getCreditedIntervals(db, 'School / Study')).toEqual([])
  })

  it('need the plant to exist and a positive length', () => {
    const db = freshDb()
    expect(() => replaceCreditedIntervals(db, 'Work', [{ start: T0, end: T0 + 1 }])).toThrow()
    upsertPlantTotal(db, 'Work', 0)
    expect(() => replaceCreditedIntervals(db, 'Work', [{ start: T0, end: T0 }])).toThrow()
  })
})
