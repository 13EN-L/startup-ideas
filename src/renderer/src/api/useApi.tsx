/* eslint-disable react-refresh/only-export-components -- the provider and its hook belong together */
import { createContext, useContext, type ReactNode } from 'react'
import type { FocusGardenApi } from '../../../shared/api'
import { createMockApi } from './mockApi'

const ApiContext = createContext<FocusGardenApi | null>(null)

let fallback: FocusGardenApi | undefined

// window.api comes from the preload script. Without it (the renderer opened on its own, e.g.
// in a browser while designing pages), fall back to the in-memory mock.
function defaultApi(): FocusGardenApi {
  if (typeof window !== 'undefined' && window.api) return window.api
  fallback ??= createMockApi()
  return fallback
}

export function ApiProvider(props: {
  api: FocusGardenApi
  children: ReactNode
}): React.JSX.Element {
  return <ApiContext.Provider value={props.api}>{props.children}</ApiContext.Provider>
}

export function useApi(): FocusGardenApi {
  return useContext(ApiContext) ?? defaultApi()
}
