import { useEffect, useState } from 'react'
import { useApi } from './api/useApi'
import { ApiKeyPopup } from './components'
import type { Route } from './navigation'
import { GardenPage } from './pages/GardenPage'
import { MainPage } from './pages/MainPage'
import { TaskPage } from './pages/TaskPage'

function App(): React.JSX.Element | null {
  const api = useApi()
  const [route, setRoute] = useState<Route | null>(null)
  const [askForKey, setAskForKey] = useState(false)

  // Resume where the user left off: with tasks still running, start on the task page.
  useEffect(() => {
    let alive = true
    void Promise.all([api.tasks.listActive(), api.settings.hasApiKey()]).then(
      ([active, hasKey]) => {
        if (!alive) return
        setRoute(active.length > 0 ? { page: 'task' } : { page: 'main' })
        setAskForKey(!hasKey)
      }
    )
    return () => {
      alive = false
    }
  }, [api])

  if (!route) return null
  return (
    <>
      {route.page === 'main' && <MainPage navigate={setRoute} />}
      {route.page === 'task' && (
        <TaskPage navigate={setRoute} openResultsFor={route.openResultsFor} />
      )}
      {route.page === 'garden' && <GardenPage navigate={setRoute} />}
      {askForKey && <ApiKeyPopup onClose={() => setAskForKey(false)} />}
    </>
  )
}

export default App
