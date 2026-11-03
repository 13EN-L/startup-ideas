import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// CLAUDE.md: colors live in src/renderer/theme.ts; components never hardcode hex values.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('renderer sources', () => {
  it('contain no hex color values', () => {
    const root = join(__dirname)
    const offenders = sourceFiles(root).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          /#[0-9a-fA-F]{3,8}\b/.test(line) ? [`${relative(root, file)}:${i + 1}`] : []
        )
    )
    expect(offenders).toEqual([])
  })
})
