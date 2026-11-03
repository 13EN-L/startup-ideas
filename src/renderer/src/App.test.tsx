// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createMockApi } from './api/mockApi'
import { ApiProvider } from './api/useApi'

function renderApp(api = createMockApi()): void {
  render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>
  )
}

describe('App', () => {
  it('opens the main page when no tasks are active', async () => {
    renderApp(createMockApi({ activeTasks: 0 }))
    expect(await screen.findByRole('main', { name: 'Main page' })).toBeInTheDocument()
  })

  it('resumes on the task page when tasks are still active', async () => {
    renderApp(createMockApi({ activeTasks: 2 }))
    expect(await screen.findByRole('main', { name: 'Task page' })).toBeInTheDocument()
  })

  it('asks for the Claude API key when none is saved, and can be skipped', async () => {
    renderApp(createMockApi({ activeTasks: 0 }))
    expect(await screen.findByRole('dialog', { name: 'Connect Claude' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not ask when a key is already saved', async () => {
    const api = createMockApi({ activeTasks: 0 })
    await api.settings.setApiKey('sk-ant-test')
    renderApp(api)
    await screen.findByRole('main', { name: 'Main page' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
