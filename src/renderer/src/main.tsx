import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/700.css'
import './styles/global.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { createMockApi } from './api/mockApi'
import { ApiProvider } from './api/useApi'
import { previewOptions } from './preview'
import { applyTheme } from './theme/applyTheme'

applyTheme()

const preview = previewOptions(window.location.search)
const app = <App initialRoute={preview.initialRoute} />

function previewApi(): ReturnType<typeof createMockApi> {
  const api = createMockApi({ activeTasks: preview.activeTasks })
  void api.settings.setApiKey('preview') // keep the key popup from covering previews
  return api
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {preview.mock ? <ApiProvider api={previewApi()}>{app}</ApiProvider> : app}
  </StrictMode>
)
