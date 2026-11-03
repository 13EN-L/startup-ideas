import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Component tests opt into jsdom per file; unmount after each so tests don't share a DOM.
afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})
