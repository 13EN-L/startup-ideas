import type { Trophy } from '../../shared/domain'

// Reward tuning from docs/rewards.md. Everything else is derived from these.
export const MINUTES_PER_STAGE = 6
export const MINUTES_PER_PLANT = 36
export const MAX_STAGE_SCALE_UP = 0.1

export const STAGES_PER_PLANT = MINUTES_PER_PLANT / MINUTES_PER_STAGE
export const SECONDS_PER_STAGE = MINUTES_PER_STAGE * 60
export const SECONDS_PER_CYCLE = MINUTES_PER_PLANT * 60

// Minimum global prestige for each trophy.
export const TROPHY_THRESHOLDS = { bronze: 1, silver: 10, gold: 100 } as const satisfies Record<
  Trophy,
  number
>
