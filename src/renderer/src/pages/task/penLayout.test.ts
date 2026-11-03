import { describe, expect, it } from 'vitest'
import { assignSections, formatElapsed } from './penLayout'

describe('assignSections', () => {
  it('fills free sections in order', () => {
    expect(assignSections([null, null, null], [4, 7], new Set())).toEqual([4, 7, null])
  })

  it('keeps tasks in their section while they stay active', () => {
    expect(assignSections([null, 4, 7], [7, 4, 9], new Set())).toEqual([9, 4, 7])
  })

  it('frees the section of a task that is no longer active', () => {
    expect(assignSections([1, 2, 3], [1, 3], new Set())).toEqual([1, null, 3])
  })

  it('keeps an exiting animal in place until its exit finishes', () => {
    expect(assignSections([1, 2, null], [1], new Set([2]))).toEqual([1, 2, null])
  })

  it('never places more than 3 animals', () => {
    expect(assignSections([null, null, null], [1, 2, 3, 4], new Set())).toEqual([1, 2, 3])
  })
})

describe('formatElapsed', () => {
  it('formats as h:mm:ss', () => {
    expect(formatElapsed(0)).toBe('0:00:00')
    expect(formatElapsed(12 * 60 + 5)).toBe('0:12:05')
    expect(formatElapsed(3 * 3600 + 59)).toBe('3:00:59')
  })

  it('never goes negative', () => {
    expect(formatElapsed(-4)).toBe('0:00:00')
  })
})
