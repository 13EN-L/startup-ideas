import type { GardenPlant, GardenState } from '../../../../shared/api'
import { CATEGORIES, PLANT_FOR_CATEGORY, type Trophy } from '../../../../shared/domain'

// Sample gardens for tests: n plants, one per category, in position order.
export function samplePlants(count: number): GardenPlant[] {
  return CATEGORIES.slice(0, count).map((category, i) => ({
    category,
    plant: PLANT_FOR_CATEGORY[category],
    position: i + 1,
    stage: (i % 6) + 1,
    scale: 1 + (i % 3) * 0.05,
    prestige: i,
    totalSeconds: i * 2160 + (i % 6) * 360 + (i % 3) * 180,
    progress: (i % 3) * 0.5,
    secondsIntoStage: (i % 3) * 180,
    secondsPerStage: 360,
    stagesPerCycle: 6
  }))
}

export function sampleGarden(count: number, globalPrestige = 0): GardenState {
  const trophies: Trophy[] = []
  if (globalPrestige >= 1) trophies.push('bronze')
  if (globalPrestige >= 10) trophies.push('silver')
  if (globalPrestige >= 100) trophies.push('gold')
  return { plants: samplePlants(count), globalPrestige, trophies }
}
