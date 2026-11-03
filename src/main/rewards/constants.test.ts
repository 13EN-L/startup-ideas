import { describe, expect, it } from 'vitest'
import {
  MAX_STAGE_SCALE_UP,
  MINUTES_PER_PLANT,
  MINUTES_PER_STAGE,
  SECONDS_PER_CYCLE,
  SECONDS_PER_STAGE,
  STAGES_PER_PLANT,
  TROPHY_THRESHOLDS
} from './constants'

describe('reward constants', () => {
  it('match docs/rewards.md', () => {
    expect(MINUTES_PER_STAGE).toBe(6)
    expect(MINUTES_PER_PLANT).toBe(36)
    expect(MAX_STAGE_SCALE_UP).toBe(0.1)
    expect(TROPHY_THRESHOLDS).toEqual({ bronze: 1, silver: 10, gold: 100 })
  })

  it('derive stage and cycle lengths from the minute constants', () => {
    expect(STAGES_PER_PLANT).toBe(6)
    expect(SECONDS_PER_STAGE).toBe(360)
    expect(SECONDS_PER_CYCLE).toBe(2160)
  })
})
