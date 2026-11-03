import type { DatabaseSync } from 'node:sqlite'
import type { GardenState } from '../../shared/api'
import { PLANT_FOR_CATEGORY } from '../../shared/domain'
import { listPlants } from '../db'
import { globalPrestige, plantState, trophiesFor } from '../rewards'

// Everything shown in the garden is derived from the stored plant totals.
export function getGardenState(db: DatabaseSync): GardenState {
  const rows = listPlants(db)
  const total = globalPrestige(rows.map((row) => row.totalSeconds))
  return {
    plants: rows.map((row) => {
      const { stage, scale, prestige } = plantState(row.totalSeconds)
      return {
        category: row.category,
        plant: PLANT_FOR_CATEGORY[row.category],
        position: row.position,
        stage,
        scale,
        prestige
      }
    }),
    globalPrestige: total,
    trophies: trophiesFor(total)
  }
}
