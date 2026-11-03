// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FocusGardenApi, TaskResults } from '../../../shared/api'
import { CATEGORIES } from '../../../shared/domain'
import { ApiProvider } from '../api/useApi'
import { createMockApi } from '../api/mockApi'
import {
  ApiKeyPopup,
  CategorySelect,
  Cloud,
  FarmSpinner,
  HomeSign,
  PixelButton,
  PixelTextInput,
  Popup,
  RecentClouds,
  Sky,
  SkyWindow,
  TaskResultsPopup,
  TimeBar
} from '.'

const task = {
  id: 1,
  name: 'Essay',
  category: 'School / Study' as const,
  animal: 'Cow' as const,
  startedAt: 0,
  stoppedAt: 2_400_000,
  status: 'done' as const
}

const doneResults: TaskResults = {
  waiting: null,
  task,
  buckets: { productiveSeconds: 1500, unproductiveSeconds: 300, idleSeconds: 600 },
  items: [
    { name: 'docs.google.com', seconds: 1500, label: 'on-task' },
    { name: 'reddit.com', seconds: 300, label: 'off-task' }
  ]
}

const pendingResults: TaskResults = {
  waiting: 'labeling',
  task: { ...task, status: 'pending' },
  buckets: { productiveSeconds: null, unproductiveSeconds: null, idleSeconds: 600 },
  items: doneResults.items.map((i) => ({ ...i, label: null }))
}

function withApi(api: FocusGardenApi, ui: React.ReactNode): ReturnType<typeof render> {
  return render(<ApiProvider api={api}>{ui}</ApiProvider>)
}

describe('Sky and SkyWindow', () => {
  it('fills the given fraction of the page height', () => {
    render(
      <Sky heightFraction={2 / 3}>
        <SkyWindow>inside</SkyWindow>
      </Sky>
    )
    expect(screen.getByTestId('sky')).toHaveStyle({ height: `${(2 / 3) * 100}%` })
    expect(within(screen.getByTestId('sky-window')).getByText('inside')).toBeInTheDocument()
  })
})

describe('PixelButton', () => {
  it('clicks when enabled and ignores clicks when disabled', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<PixelButton onClick={onClick}>start task</PixelButton>)
    await userEvent.click(screen.getByRole('button', { name: 'start task' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <PixelButton onClick={onClick} disabled>
        start task
      </PixelButton>
    )
    expect(screen.getByRole('button', { name: 'start task' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'start task' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('PixelTextInput and CategorySelect', () => {
  it('shows the "enter task" placeholder and reports typing', async () => {
    const onChange = vi.fn()
    render(
      <PixelTextInput label="task name" placeholder="enter task" value="" onChange={onChange} />
    )
    const input = screen.getByPlaceholderText('enter task')
    await userEvent.type(input, 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('lists the 10 categories under a "category" placeholder', async () => {
    const onChange = vi.fn()
    render(<CategorySelect value="" onChange={onChange} />)
    const select = screen.getByRole('combobox', { name: 'category' })
    const options = within(select).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['category', ...CATEGORIES])
    await userEvent.selectOptions(select, 'Finance')
    expect(onChange).toHaveBeenCalledWith('Finance')
  })
})

describe('HomeSign', () => {
  it('is clickable when active', async () => {
    const onClick = vi.fn()
    render(<HomeSign active onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'home' }))
    expect(onClick).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'home' })).toHaveAttribute('data-state', 'active')
  })

  it('is greyed out and ignores clicks when deactivated', async () => {
    const onClick = vi.fn()
    render(<HomeSign active={false} onClick={onClick} />)
    const sign = screen.getByRole('button', { name: 'home' })
    expect(sign).toBeDisabled()
    expect(sign).toHaveAttribute('data-state', 'inactive')
    await userEvent.click(sign)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Cloud', () => {
  it('is a button with the task name when clickable', async () => {
    const onClick = vi.fn()
    render(<Cloud label="Essay" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'Essay' }))
    expect(onClick).toHaveBeenCalled()
  })

  it('is decorative without a click handler', () => {
    render(<Cloud />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByTestId('cloud')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('RecentClouds', () => {
  it('shows the 5 most recent task names and passes the clicked task id', async () => {
    const api = createMockApi({ activeTasks: 0 })
    const recent = await api.tasks.listRecent()
    const onSelect = vi.fn()
    withApi(api, <RecentClouds onSelect={onSelect} />)

    const clouds = await screen.findAllByRole('button')
    expect(clouds.map((c) => c.textContent)).toEqual(recent.map((t) => t.name))
    await userEvent.click(clouds[2])
    expect(onSelect).toHaveBeenCalledWith(recent[2].id)
  })

  it('refreshes when a task gets its results', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const api = createMockApi({ activeTasks: 0, resultDelayMs: 10 })
    withApi(api, <RecentClouds onSelect={() => {}} />)
    await screen.findAllByRole('button')

    const started = await api.tasks.start({ name: 'Brand new', category: 'Work' })
    await api.tasks.stop(started.id)
    await act(() => vi.advanceTimersByTimeAsync(20))
    expect(await screen.findByRole('button', { name: 'Brand new' })).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('Popup', () => {
  it('is a labeled modal that closes on Esc and on its close button', async () => {
    const onClose = vi.fn()
    render(
      <Popup label="Results" onClose={onClose}>
        <button>inside</button>
      </Popup>
    )
    const dialog = screen.getByRole('dialog', { name: 'Results' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('button', { name: 'inside' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('keeps focus inside while tabbing', async () => {
    render(
      <Popup label="Results" onClose={() => {}}>
        <button>first</button>
      </Popup>
    )
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.tab()
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })
})

describe('FarmSpinner', () => {
  it('announces its message', () => {
    render(<FarmSpinner message="Sorting the harvest…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Sorting the harvest…')
  })
})

describe('TimeBar', () => {
  it('splits a labeled task into on-task, off-task and idle with percentages', () => {
    render(<TimeBar results={doneResults} />)
    expect(screen.getByTestId('segment-on-task')).toHaveTextContent('63%')
    expect(screen.getByTestId('segment-off-task')).toHaveTextContent('12%')
    expect(screen.getByTestId('segment-idle')).toHaveTextContent('25%')
    expect(screen.getByTestId('segment-on-task')).toHaveStyle({ width: '63%' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a spinner in place of on/off-task while pending, but idle right away', () => {
    render(<TimeBar results={pendingResults} />)
    expect(screen.queryByTestId('segment-on-task')).not.toBeInTheDocument()
    expect(screen.queryByTestId('segment-off-task')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByTestId('segment-pending')).toHaveStyle({ width: '75%' })
    expect(screen.getByTestId('segment-idle')).toHaveTextContent('25%')
  })

  it('hides empty segments', () => {
    render(
      <TimeBar
        results={{
          ...doneResults,
          buckets: { productiveSeconds: 100, unproductiveSeconds: 0, idleSeconds: 0 }
        }}
      />
    )
    expect(screen.queryByTestId('segment-off-task')).not.toBeInTheDocument()
    expect(screen.queryByTestId('segment-idle')).not.toBeInTheDocument()
  })
})

describe('TimeBar while waiting', () => {
  it.each([
    ['reading-activity', 'Reading what you did…'],
    ['activitywatch', 'Waiting for ActivityWatch…'],
    ['labeling', 'Sorting the harvest…'],
    ['retrying', 'Claude is busy. Trying again soon…']
  ] as const)('shows a spinner with the reason for %s', (waiting, message) => {
    render(<TimeBar results={{ ...pendingResults, waiting }} />)
    expect(screen.getByRole('status')).toHaveTextContent(message)
    expect(screen.getByTestId('segment-pending')).toHaveAttribute('data-blocked', 'false')
  })

  it.each([
    ['no-api-key', 'Needs a Claude API key'],
    ['api-key-rejected', 'API key rejected'],
    ['claude-error', 'Claude couldn’t sort this']
  ] as const)(
    'shows %s without a spinner, since nothing is happening until you act',
    (waiting, message) => {
      render(<TimeBar results={{ ...pendingResults, waiting }} />)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.getByTestId('segment-pending')).toHaveTextContent(message)
      expect(screen.getByTestId('segment-pending')).toHaveAttribute('data-blocked', 'true')
    }
  )
})

describe('TaskResultsPopup', () => {
  function apiReturning(results: TaskResults[]): FocusGardenApi & {
    fire: (taskId: number) => void
  } {
    const listeners = new Set<(id: number) => void>()
    const base = createMockApi()
    let call = 0
    return {
      ...base,
      tasks: {
        ...base.tasks,
        getResults: async () => results[Math.min(call++, results.length - 1)]
      },
      events: {
        ...base.events,
        onTaskResults: (cb) => {
          listeners.add(cb)
          return () => listeners.delete(cb)
        }
      },
      fire: (id) => listeners.forEach((cb) => cb(id))
    }
  }

  it('shows the title, time bar, "What you did:" and the item list, in that order', async () => {
    withApi(apiReturning([doneResults]), <TaskResultsPopup taskId={1} onClose={() => {}} />)
    const dialog = await screen.findByRole('dialog', { name: 'Essay' })
    const heading = within(dialog).getByRole('heading', { name: 'Essay' })
    const bar = within(dialog).getByTestId('time-bar')
    const subtitle = within(dialog).getByText('What you did:')
    const list = within(dialog).getByRole('list')
    const order = [heading, bar, subtitle, list]
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    }
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('docs.google.com')
    expect(rows[0]).toHaveTextContent('25m 00s')
    expect(rows[0]).toHaveTextContent('on-task')
    expect(rows[1]).toHaveTextContent('off-task')
  })

  it('fills in labels when results arrive', async () => {
    const api = apiReturning([pendingResults, doneResults])
    withApi(api, <TaskResultsPopup taskId={1} onClose={() => {}} />)
    const list = await screen.findByRole('list')
    expect(within(list).queryByText('on-task')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => api.fire(2))
    act(() => api.fire(1))
    expect(await within(list).findByText('on-task')).toBeInTheDocument()
  })
})

describe('TaskResultsPopup when the API key is the problem', () => {
  function apiWith(results: TaskResults): FocusGardenApi {
    const base = createMockApi()
    return { ...base, tasks: { ...base.tasks, getResults: async () => results } }
  }

  it.each([
    ['no-api-key', 'add key', 'Add your Claude API key'],
    ['api-key-rejected', 'change key', 'didn’t accept your API key'],
    ['claude-error', 'change key', 'Check your API key and account']
  ] as const)(
    'explains %s and offers a "%s" button that opens the key popup',
    async (waiting, button, note) => {
      const api = apiWith({ ...pendingResults, waiting })
      const setApiKey = vi.spyOn(api.settings, 'setApiKey')
      withApi(api, <TaskResultsPopup taskId={1} onClose={() => {}} />)

      expect(await screen.findByText(new RegExp(note))).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: button }))
      const keyPopup = screen.getByRole('dialog', { name: 'Connect Claude' })
      await userEvent.type(within(keyPopup).getByLabelText('Claude API key'), 'sk-ant-new')
      await userEvent.click(within(keyPopup).getByRole('button', { name: 'save' }))

      expect(setApiKey).toHaveBeenCalledWith('sk-ant-new')
      expect(screen.queryByRole('dialog', { name: 'Connect Claude' })).not.toBeInTheDocument()
    }
  )

  it('offers no key button while Claude is simply working', async () => {
    withApi(apiWith(pendingResults), <TaskResultsPopup taskId={1} onClose={() => {}} />)
    await screen.findByRole('dialog', { name: 'Essay' })
    expect(screen.queryByRole('button', { name: /key/ })).not.toBeInTheDocument()
  })
})

describe('ApiKeyPopup', () => {
  it('saves the key, then clears it from the page', async () => {
    const api = createMockApi()
    const setApiKey = vi.spyOn(api.settings, 'setApiKey')
    const onClose = vi.fn()
    withApi(api, <ApiKeyPopup onClose={onClose} />)

    const input = screen.getByLabelText('Claude API key')
    expect(input).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
    await userEvent.type(input, 'sk-ant-test')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(setApiKey).toHaveBeenCalledWith('sk-ant-test')
    expect(onClose).toHaveBeenCalledWith(true)
    expect(input).toHaveValue('')
    expect(document.body.innerHTML).not.toContain('sk-ant-test')
  })

  it('can be skipped', async () => {
    const onClose = vi.fn()
    withApi(createMockApi(), <ApiKeyPopup onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(onClose).toHaveBeenCalledWith(false)
  })

  it('shows an error when saving fails', async () => {
    const api = createMockApi()
    vi.spyOn(api.settings, 'setApiKey').mockRejectedValue(new Error('no keychain'))
    const onClose = vi.fn()
    withApi(api, <ApiKeyPopup onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('Claude API key'), 'sk-ant-test')
    await userEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save the key')
    expect(onClose).not.toHaveBeenCalled()
  })
})
