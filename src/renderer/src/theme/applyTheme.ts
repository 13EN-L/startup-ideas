import { colors } from '../../theme'

export type ColorName = keyof typeof colors

const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

// CSS reference to a palette color, e.g. cssVar('darkBrown') → 'var(--color-dark-brown)'.
export function cssVar(name: ColorName): string {
  return `var(--color-${kebab(name)})`
}

// Publishes the palette from theme.ts as CSS variables so stylesheets never repeat hex values.
export function applyTheme(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(colors)) {
    root.style.setProperty(`--color-${kebab(name)}`, value)
  }
}
