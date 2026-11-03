import { MAX_STAGE_SCALE_UP, SECONDS_PER_CYCLE, SECONDS_PER_STAGE } from './constants'

export interface PlantState {
  prestige: number
  stage: number // 1 to STAGES_PER_PLANT
  progress: number // 0 to 1 within the current stage
  scale: number // 1 to 1 + MAX_STAGE_SCALE_UP
}

// Everything about a plant's look is derived from its total productive seconds.
export function plantState(totalSeconds: number): PlantState {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    throw new RangeError(`Invalid plant total: ${totalSeconds}`)
  }
  const timeInCycle = totalSeconds % SECONDS_PER_CYCLE
  const progress = (timeInCycle % SECONDS_PER_STAGE) / SECONDS_PER_STAGE

  return {
    prestige: Math.floor(totalSeconds / SECONDS_PER_CYCLE),
    stage: Math.floor(timeInCycle / SECONDS_PER_STAGE) + 1,
    progress,
    scale: 1 + MAX_STAGE_SCALE_UP * progress
  }
}
