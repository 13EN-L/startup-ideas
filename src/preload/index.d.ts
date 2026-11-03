import type { FocusGardenApi } from '../shared/api'

declare global {
  interface Window {
    api: FocusGardenApi
  }
}
