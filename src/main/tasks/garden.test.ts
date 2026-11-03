import { describe, expect, it } from 'vitest'
import { upsertPlantTotal } from '../db'
import { freshDb } from '../db/test-helpers'
import { getGardenState } from './garden'

const CYCLE = 36 * 60

describe('getGardenState', () => {
  it('is empty before any plant exists', () => {
    expect(getGardenState(freshDb())).toEqual({ plants: [], globalPrestige: 0, trophies: [] })
  })

  it('derives each plant’s stage, scale and prestige, in the order plants appeared', () => {
    const db = freshDb()
    upsertPlantTotal(db, 'School / Study', 20 * 60)
    upsertPlantTotal(db, 'Work', CYCLE + 9 * 60)

    const state = getGardenState(db)
    expect(state.plants).toEqual([
      {
        category: 'School / Study',
        plant: 'Tomato',
        position: 1,
        stage: 4,
        scale: expect.closeTo(1 + 0.1 * (2 / 6)),
        prestige: 0
      },
      {
        category: 'Work',
        plant: 'Pine',
        position: 2,
        stage: 2,
        scale: expect.closeTo(1.05),
        prestige: 1
      }
    ])
    expect(state.globalPrestige).toBe(1)
    expect(state.trophies).toEqual(['bronze'])
  })

  it('earns silver at 10 global prestige', () => {
    const db = freshDb()
    upsertPlantTotal(db, 'Work', 6 * CYCLE)
    upsertPlantTotal(db, 'Home', 4 * CYCLE)
    expect(getGardenState(db)).toMatchObject({ globalPrestige: 10, trophies: ['bronze', 'silver'] })
  })
})
