import { describe, expect, it } from 'vitest'
import { previewOptions } from './preview'

describe('previewOptions', () => {
  it('is off for the real app, which loads without a query string', () => {
    expect(previewOptions('')).toEqual({ mock: false, activeTasks: 2, initialRoute: undefined })
  })

  it('reads ?mock, ?active and ?page', () => {
    expect(previewOptions('?mock&active=3&page=garden')).toEqual({
      mock: true,
      activeTasks: 3,
      initialRoute: { page: 'garden' }
    })
  })

  it('ignores unknown pages and bad counts', () => {
    expect(previewOptions('?mock&page=attic&active=lots')).toEqual({
      mock: true,
      activeTasks: 2,
      initialRoute: undefined
    })
  })

  it('clamps the active task count to 0..3', () => {
    expect(previewOptions('?active=9').activeTasks).toBe(3)
    expect(previewOptions('?active=-1').activeTasks).toBe(0)
  })
})
