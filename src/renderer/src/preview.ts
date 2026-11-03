import type { Route } from './navigation'

// Query-string options for previewing pages without the main process, e.g.
// index.html?mock&page=garden&active=3 (used by scripts/screenshot.mjs). The real app always
// loads index.html without a query string, so none of this applies to it.
export interface PreviewOptions {
  mock: boolean // use the in-memory mock API instead of window.api
  activeTasks: number // sample tasks already in the pen, for the mock
  initialRoute: Route | undefined // start on this page instead of following the resume rule
}

const PAGES = ['main', 'task', 'garden'] as const

export function previewOptions(search: string): PreviewOptions {
  const params = new URLSearchParams(search)
  const page = params.get('page')
  const active = Number.parseInt(params.get('active') ?? '', 10)
  return {
    mock: params.has('mock'),
    activeTasks: Number.isNaN(active) ? 2 : Math.min(3, Math.max(0, active)),
    initialRoute: PAGES.find((p) => p === page)
      ? ({ page: page as Route['page'] } as Route)
      : undefined
  }
}
