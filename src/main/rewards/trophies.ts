import { TROPHY_THRESHOLDS } from './constants'
import { plantState } from './plant'

export type Trophy = keyof typeof TROPHY_THRESHOLDS

const TROPHY_ORDER: readonly Trophy[] = ['bronze', 'silver', 'gold']

export function globalPrestige(plantTotalSeconds: readonly number[]): number {
  return plantTotalSeconds.reduce((sum, total) => sum + plantState(total).prestige, 0)
}

// Earned trophies in display order. Prestige never goes down, so trophies stay once earned.
export function trophiesFor(globalPrestige: number): Trophy[] {
  return TROPHY_ORDER.filter((trophy) => globalPrestige >= TROPHY_THRESHOLDS[trophy])
}
