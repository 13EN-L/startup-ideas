// The app's three pages. Opening the task page with openResultsFor shows that task's results
// popup right away (used by the main page's recent-task clouds).
export type Route =
  { page: 'main' } | { page: 'task'; openResultsFor?: number } | { page: 'garden' }

export interface PageProps {
  navigate: (route: Route) => void
  openResultsFor?: number
}
