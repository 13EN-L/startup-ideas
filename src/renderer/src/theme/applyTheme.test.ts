// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { colors } from '../../theme'
import { applyTheme, cssVar } from './applyTheme'

describe('applyTheme', () => {
  it('exposes every palette color as a CSS variable', () => {
    const root = document.createElement('div')
    applyTheme(root)
    expect(root.style.getPropertyValue('--color-dark-brown')).toBe(colors.darkBrown)
    expect(root.style.getPropertyValue('--color-sky')).toBe(colors.sky)
    for (const key of Object.keys(colors) as (keyof typeof colors)[]) {
      expect(root.style.getPropertyValue(cssVar(key).slice(4, -1))).toBe(colors[key])
    }
  })

  it('names variables in kebab case', () => {
    expect(cssVar('signPostInactive')).toBe('var(--color-sign-post-inactive)')
  })
})
