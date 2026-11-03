import { describe, expect, it } from 'vitest'
import { mergeIntervals, subtractIntervals, totalSeconds } from './intervals'

const s = (start: number, end: number): { start: number; end: number } => ({
  start: start * 1000,
  end: end * 1000
})

describe('mergeIntervals', () => {
  it('returns nothing for no intervals', () => {
    expect(mergeIntervals([])).toEqual([])
  })

  it('sorts and keeps separate intervals apart', () => {
    expect(mergeIntervals([s(20, 30), s(0, 10)])).toEqual([s(0, 10), s(20, 30)])
  })

  it('merges partly overlapping intervals so time counts once', () => {
    expect(mergeIntervals([s(0, 10), s(5, 15)])).toEqual([s(0, 15)])
  })

  it('merges an interval contained in another', () => {
    expect(mergeIntervals([s(0, 30), s(10, 20)])).toEqual([s(0, 30)])
  })

  it('merges touching intervals', () => {
    expect(mergeIntervals([s(0, 10), s(10, 20)])).toEqual([s(0, 20)])
  })

  it('drops zero-length intervals', () => {
    expect(mergeIntervals([s(5, 5), s(10, 20)])).toEqual([s(10, 20)])
  })

  it('does not change its input', () => {
    const input = [s(20, 30), s(0, 25)]
    mergeIntervals(input)
    expect(input).toEqual([s(20, 30), s(0, 25)])
  })

  it('rejects an interval that ends before it starts', () => {
    expect(() => mergeIntervals([s(10, 5)])).toThrow(RangeError)
    expect(() => mergeIntervals([s(10, 5)])).toThrow('Invalid interval: 10000 to 5000')
  })

  it('rejects non-finite times', () => {
    expect(() => mergeIntervals([{ start: 0, end: Number.NaN }])).toThrow(RangeError)
    expect(() => mergeIntervals([{ start: Number.NEGATIVE_INFINITY, end: 0 }])).toThrow(RangeError)
  })
})

describe('subtractIntervals', () => {
  it('returns the original time when nothing is removed', () => {
    expect(subtractIntervals([s(0, 10)], [])).toEqual([s(0, 10)])
  })

  it('removes a middle section', () => {
    expect(subtractIntervals([s(0, 30)], [s(10, 20)])).toEqual([s(0, 10), s(20, 30)])
  })

  it('trims the start and the end', () => {
    expect(subtractIntervals([s(10, 20)], [s(0, 12), s(18, 40)])).toEqual([s(12, 18)])
  })

  it('leaves no zero-length piece when a cut lines up with an edge', () => {
    expect(subtractIntervals([s(0, 10)], [s(0, 5)])).toEqual([s(5, 10)])
    expect(subtractIntervals([s(0, 10)], [s(5, 10)])).toEqual([s(0, 5)])
    expect(subtractIntervals([s(0, 10)], [s(0, 10)])).toEqual([])
  })

  it('removes everything when fully covered', () => {
    expect(subtractIntervals([s(10, 20)], [s(0, 40)])).toEqual([])
  })

  it('ignores removals that only touch the edges', () => {
    expect(subtractIntervals([s(10, 20)], [s(0, 10), s(20, 30)])).toEqual([s(10, 20)])
  })

  it('handles several intervals on both sides', () => {
    expect(subtractIntervals([s(0, 10), s(20, 30)], [s(5, 25)])).toEqual([s(0, 5), s(25, 30)])
  })

  it('merges overlapping input first', () => {
    expect(subtractIntervals([s(0, 10), s(5, 20)], [s(8, 12)])).toEqual([s(0, 8), s(12, 20)])
  })
})

describe('totalSeconds', () => {
  it('is 0 for no intervals', () => {
    expect(totalSeconds([])).toBe(0)
  })

  it('sums intervals in seconds', () => {
    expect(totalSeconds([s(0, 10), s(20, 25)])).toBe(15)
  })

  it('counts overlapping time once', () => {
    expect(totalSeconds([s(0, 10), s(5, 15)])).toBe(15)
  })

  it('keeps partial seconds', () => {
    expect(totalSeconds([{ start: 0, end: 1500 }])).toBe(1.5)
  })
})
