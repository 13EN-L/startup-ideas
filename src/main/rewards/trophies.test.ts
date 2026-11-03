import { describe, expect, it } from 'vitest'
import { globalPrestige, trophiesFor } from './trophies'

describe('globalPrestige', () => {
  it('is 0 with no plants', () => {
    expect(globalPrestige([])).toBe(0)
  })

  it('sums every plant’s prestige', () => {
    expect(globalPrestige([2160 * 2 + 100, 2160, 2159])).toBe(3)
  })
})

describe('trophiesFor', () => {
  it.each([
    [0, []],
    [1, ['bronze']],
    [9, ['bronze']],
    [10, ['bronze', 'silver']],
    [99, ['bronze', 'silver']],
    [100, ['bronze', 'silver', 'gold']],
    [250, ['bronze', 'silver', 'gold']]
  ])('global prestige %i earns %j', (prestige, expected) => {
    expect(trophiesFor(prestige)).toEqual(expected)
  })
})
