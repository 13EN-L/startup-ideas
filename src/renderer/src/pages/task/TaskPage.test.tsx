// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FocusGardenApi } from '../../../../shared/api'
import { createMockApi } from '../../api/mockApi'
import { ApiProvider } from '../../api/useApi'
import type { Route } from '../../navigation'
import { TaskPage } from '../TaskPage'
import { EXIT_MS } from './penLayout'

function renderPage(
  api: FocusGardenApi,
  props: { openResultsFor?: number } = {}
): { navigate: ReturnType<typeof vi.fn<(route: Route) => void>> } {
  const navigate = vi.fn<(route: Route) => void>()
  render(
    <ApiProvider api={api}>
      <TaskPage navigate={navigate} {...props} />
    </ApiProvider>
  )
  return { navigate }
}

const animals = (): HTMLElement[] => screen.queryAllByTestId('animal')
const startButton = (): HTMLElement => screen.getByRole('button', { name: 'start task' })

async function fillForm(name: string, category = 'Work'): Promise<void> {
  await userEvent.type(screen.getByPlaceholderText('enter task'), name)
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'category' }), category)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('TaskPage sky', () => {
  it('fills the top 2/3 with a window holding the text box, category, then start task', () => {
    renderPage(createMockApi({ activeTasks: 0 }))
    expect(screen.getByTestId('sky')).toHaveStyle({ height: `${(2 / 3) * 100}%` })
    const window = screen.getByTestId('sky-window')
    const controls = [...window.querySelectorAll('input, select, button')]
    expect(controls).toEqual([
      within(window).getByPlaceholderText('enter task'),
      within(window).getByRole('combobox', { name: 'category' }),
      within(window).getByRole('button', { name: 'start task' })
    ])
  })

  it('keeps start disabled until there is a name and a category', async () => {
    renderPage(createMockApi({ activeTasks: 0 }))
    expect(startButton()).toBeDisabled()
    await userEvent.type(screen.getByPlaceholderText('enter task'), 'Read')
    expect(startButton()).toBeDisabled()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'category' }), 'Work')
    expect(startButton()).toBeEnabled()
  })

  it('treats a blank name as no name', async () => {
    renderPage(createMockApi({ activeTasks: 0 }))
    await fillForm('   ')
    expect(startButton()).toBeDisabled()
  })

  it('greys out start when 3 animals are in the pen', async () => {
    renderPage(createMockApi({ activeTasks: 3 }))
    await screen.findAllByTestId('animal')
    await fillForm('Fourth')
    expect(startButton()).toBeDisabled()
  })

  it('starts a task: adds its animal and clears the form', async () => {
    const api = createMockApi({ activeTasks: 0 })
    const start = vi.spyOn(api.tasks, 'start')
    renderPage(api)
    await fillForm('Read chapter 3', 'School / Study')
    await userEvent.click(startButton())

    expect(start).toHaveBeenCalledWith({ name: 'Read chapter 3', category: 'School / Study' })
    expect(await screen.findByRole('button', { name: /^Read chapter 3 \(/ })).toBeInTheDocument()
    expect(animals()).toHaveLength(1)
    expect(screen.getByPlaceholderText('enter task')).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'category' })).toHaveValue('')
  })

  it('shows the error in the window when starting fails', async () => {
    const api = createMockApi({ activeTasks: 0 })
    vi.spyOn(api.tasks, 'start').mockRejectedValue(new Error('At most 3 tasks can be active'))
    renderPage(api)
    await fillForm('Too many')
    await userEvent.click(startButton())
    const alert = await within(screen.getByTestId('sky-window')).findByRole('alert')
    expect(alert).toHaveTextContent('At most 3 tasks can be active')
    expect(animals()).toHaveLength(0)
  })
})

describe('TaskPage pen', () => {
  it('shows each active task as its animal with a nametag, one per section', async () => {
    const api = createMockApi({ activeTasks: 3 })
    const active = await api.tasks.listActive()
    renderPage(api)
    expect(await screen.findAllByTestId('animal')).toHaveLength(3)

    const sections = screen.getAllByTestId('pen-section')
    expect(sections).toHaveLength(3)
    for (const [i, section] of sections.entries()) {
      expect(within(section).getAllByTestId('animal')).toHaveLength(1)
      const task = active[i]
      const animal = within(section).getByRole('button', { name: `${task.name} (${task.animal})` })
      expect(within(animal).getByTestId('nametag')).toHaveTextContent(task.name)
    }
  })

  it('shows no animals with no active tasks', async () => {
    renderPage(createMockApi({ activeTasks: 0 }))
    await screen.findAllByTestId('cloud')
    expect(animals()).toHaveLength(0)
  })

  it('has a fence and a gate', () => {
    renderPage(createMockApi({ activeTasks: 0 }))
    expect(screen.getByTestId('fence')).toBeInTheDocument()
    expect(screen.getByTestId('gate')).toHaveAttribute('data-open', 'false')
  })

  it('activates the home sign only with no tasks, and it goes to the main page', async () => {
    const { navigate } = renderPage(createMockApi({ activeTasks: 0 }))
    await screen.findAllByTestId('cloud')
    const sign = screen.getByRole('button', { name: 'home' })
    expect(sign).toBeEnabled()
    await userEvent.click(sign)
    expect(navigate).toHaveBeenCalledWith({ page: 'main' })
  })

  it('greys out the home sign while tasks are active', async () => {
    renderPage(createMockApi({ activeTasks: 1 }))
    await screen.findAllByTestId('animal')
    expect(screen.getByRole('button', { name: 'home' })).toBeDisabled()
  })

  it('reloads active tasks when a task gets results', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const api = createMockApi({ activeTasks: 0, resultDelayMs: 10 })
    renderPage(api)
    await screen.findAllByTestId('cloud')
    // Started behind the page's back, so it only shows up once the page reloads.
    await api.tasks.start({ name: 'Elsewhere', category: 'Home' })
    const other = await api.tasks.start({ name: 'Trigger', category: 'Work' })
    await api.tasks.stop(other.id)
    expect(animals()).toHaveLength(0)
    await act(() => vi.advanceTimersByTimeAsync(20))
    expect(await screen.findByRole('button', { name: /^Elsewhere \(/ })).toBeInTheDocument()
    expect(animals()).toHaveLength(1)
  })
})

describe('TaskPage stopping a task', () => {
  it('opens a popup with the elapsed time that ticks every second', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage(createMockApi({ activeTasks: 1 })) // started 15 minutes ago
    await user.click(await screen.findByRole('button', { name: /^Write essay \(/ }))

    const dialog = screen.getByRole('dialog', { name: 'Write essay' })
    expect(within(dialog).getByTestId('elapsed')).toHaveTextContent('0:15:00')
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(within(dialog).getByTestId('elapsed')).toHaveTextContent('0:15:05')
    expect(within(dialog).getByRole('button', { name: 'stop' })).toBeInTheDocument()
  })

  it('stops the task, opens the gate, and removes the animal after it walks out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const api = createMockApi({ activeTasks: 2 })
    const stop = vi.spyOn(api.tasks, 'stop')
    renderPage(api)
    const [first] = await api.tasks.listActive()
    await user.click(await screen.findByRole('button', { name: /^Write essay \(/ }))
    await user.click(screen.getByRole('button', { name: 'stop' }))

    expect(stop).toHaveBeenCalledWith(first.id)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('gate')).toHaveAttribute('data-open', 'true')
    const exiting = screen.getByRole('button', { name: /^Write essay \(/ })
    expect(exiting).toHaveAttribute('data-exiting', 'true')

    await act(() => vi.advanceTimersByTimeAsync(EXIT_MS))
    expect(screen.queryByRole('button', { name: /^Write essay \(/ })).not.toBeInTheDocument()
    expect(animals()).toHaveLength(1)
    expect(screen.getByTestId('gate')).toHaveAttribute('data-open', 'false')
    expect(within(screen.getAllByTestId('pen-section')[0]).queryAllByTestId('animal')).toEqual([])
  })
})

describe('TaskPage results', () => {
  it('opens a recent task results popup when its cloud is clicked', async () => {
    renderPage(createMockApi({ activeTasks: 0 }))
    const clouds = await screen.findAllByTestId('cloud')
    expect(clouds).toHaveLength(5)
    expect(within(screen.getByTestId('sky-window')).queryAllByTestId('cloud')).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Biology homework' }))
    expect(await screen.findByRole('dialog', { name: 'Biology homework' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens results for openResultsFor on arrival', async () => {
    const api = createMockApi({ activeTasks: 0 })
    const recent = await api.tasks.listRecent()
    const target = recent.find((t) => t.name === 'Morning run')!
    renderPage(api, { openResultsFor: target.id })
    expect(await screen.findByRole('dialog', { name: 'Morning run' })).toBeInTheDocument()
  })
})
