import { describe, expect, it } from 'vitest'
import { formatClock, formatDuration, percentages } from './format'

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [45, '45s'],
    [59.6, '1m 00s'],
    [750, '12m 30s'],
    [3599, '59m 59s'],
    [3600, '1h 00m'],
    [3900, '1h 05m'],
    [36_000 + 61, '10h 01m']
  ])('%d seconds is %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })
})

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [9.9, '0:09'],
    [353.952, '5:53'],
    [359.99, '5:59'],
    [360, '6:00'],
    [3725, '62:05']
  ])('%d seconds is %s, rounding down', (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected)
  })
})

describe('percentages', () => {
  it('splits a labeled task and always adds up to 100', () => {
    expect(
      percentages({
        buckets: { productiveSeconds: 1, unproductiveSeconds: 1, idleSeconds: 1 },
        items: []
      })
    ).toEqual({ onTask: 34, offTask: 33, idle: 33, pending: false })
  })

  it('matches the 25/5/10 example', () => {
    expect(
      percentages({
        buckets: { productiveSeconds: 1500, unproductiveSeconds: 300, idleSeconds: 600 },
        items: []
      })
    ).toEqual({ onTask: 63, offTask: 12, idle: 25, pending: false })
  })

  it('shows only idle while labels are pending, using item time for the rest', () => {
    expect(
      percentages({
        buckets: { productiveSeconds: null, unproductiveSeconds: null, idleSeconds: 600 },
        items: [{ seconds: 1200 }, { seconds: 600 }]
      })
    ).toEqual({ onTask: null, offTask: null, idle: 25, pending: true })
  })

  it('is all zero for a task with no time', () => {
    expect(
      percentages({
        buckets: { productiveSeconds: 0, unproductiveSeconds: 0, idleSeconds: 0 },
        items: []
      })
    ).toEqual({ onTask: 0, offTask: 0, idle: 0, pending: false })
  })
})
