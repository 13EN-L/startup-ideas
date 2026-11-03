// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FocusGardenApi, GardenPlant, GardenState } from '../../../../shared/api'
import { CATEGORIES, PLANT_FOR_CATEGORY } from '../../../../shared/domain'
import { plantImage } from '../../../assets/manifest'
import { createMockApi } from '../../api/mockApi'
import { ApiProvider } from '../../api/useApi'
import { MainPage } from '../MainPage'

function plants(count: number): GardenPlant[] {
  return CATEGORIES.slice(0, count).map((category, i) => ({
    category,
    plant: PLANT_FOR_CATEGORY[category],
    position: i + 1,
    stage: (i % 6) + 1,
    scale: 1,
    prestige: 0,
    totalSeconds: i * 360,
    progress: 0,
    secondsIntoStage: 0,
    secondsPerStage: 360,
    stagesPerCycle: 6
  }))
}

const state = (list: GardenPlant[]): GardenState => ({
  plants: list,
  globalPrestige: 0,
  trophies: []
})

function renderPage(api: FocusGardenApi = createMockApi()): {
  navigate: ReturnType<typeof vi.fn>
  unmount: () => void
} {
  const navigate = vi.fn()
  const { unmount } = render(
    <ApiProvider api={api}>
      <MainPage navigate={navigate} />
    </ApiProvider>
  )
  return { navigate, unmount }
}

function withGarden(list: GardenPlant[]): FocusGardenApi {
  const api = createMockApi()
  api.garden.getState = async () => state(list)
  return api
}

const preview = (): HTMLElement => screen.getByRole('button', { name: 'Open garden' })

describe('MainPage sky', () => {
  it('fills the top 3/4 with the sky', () => {
    renderPage()
    expect(screen.getByTestId('sky').style.height).toBe('75%')
  })

  it('puts the FocusGarden title inside the window, above the Tasks button', () => {
    renderPage()
    const skyWindow = screen.getByTestId('sky-window')
    const title = within(skyWindow).getByRole('heading', { name: 'FocusGarden' })
    const tasks = within(skyWindow).getByRole('button', { name: 'Tasks' })
    expect(title.compareDocumentPosition(tasks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('opens the task page from the Tasks button', async () => {
    const { navigate } = renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(navigate).toHaveBeenCalledWith({ page: 'task' })
  })

  it('shows 5 recent clouds outside the window', async () => {
    renderPage()
    const clouds = await screen.findAllByRole('button', {
      name: /homework|report|run|budget|sketch/i
    })
    expect(clouds).toHaveLength(5)
    const skyWindow = screen.getByTestId('sky-window')
    for (const cloud of clouds) {
      expect(skyWindow).not.toContainElement(cloud)
      expect(screen.getByTestId('sky')).toContainElement(cloud)
    }
  })

  it('opens the task page with results when a cloud is clicked', async () => {
    const api = createMockApi()
    const [newest] = await api.tasks.listRecent()
    const { navigate } = renderPage(api)
    await userEvent.click(await screen.findByRole('button', { name: newest.name }))
    expect(navigate).toHaveBeenCalledWith({ page: 'task', openResultsFor: newest.id })
  })
})

describe('MainPage garden preview', () => {
  it('opens the garden page when clicked', async () => {
    const { navigate } = renderPage()
    await userEvent.click(preview())
    expect(navigate).toHaveBeenCalledWith({ page: 'garden' })
  })

  it('shows each plant at its current stage, in position order', async () => {
    const [a, b, c] = plants(3)
    renderPage(withGarden([c, a, b].map((p, i) => ({ ...p, position: [3, 1, 2][i] }))))
    const images = await within(preview()).findAllByRole('img')
    expect(images.map((img) => img.getAttribute('alt'))).toEqual([a.plant, b.plant, c.plant])
    expect(images[1]).toHaveAttribute('src', plantImage(b.plant, b.stage))
  })

  it('shows a single plant alone in the centered row', async () => {
    const [only] = plants(1)
    renderPage(withGarden([only]))
    const image = await within(preview()).findByRole('img', { name: only.plant })
    const row = screen.getByTestId('preview-row')
    expect(row.children).toHaveLength(1)
    expect(row).toContainElement(image)
  })

  it('shows just the grass, still clickable, with 0 plants', async () => {
    const api = withGarden([])
    const getState = vi.spyOn(api.garden, 'getState')
    const { navigate } = renderPage(api)
    await act(async () => {
      await getState.mock.results[0]?.value
    })
    expect(within(preview()).queryAllByRole('img')).toHaveLength(0)
    await userEvent.click(preview())
    expect(navigate).toHaveBeenCalledWith({ page: 'garden' })
  })

  it('shows all 10 plants', async () => {
    renderPage(withGarden(plants(10)))
    const images = await within(preview()).findAllByRole('img')
    expect(images.map((img) => img.getAttribute('alt'))).toEqual(plants(10).map((p) => p.plant))
  })

  it('reloads when the garden changes and unsubscribes on unmount', async () => {
    const api = createMockApi()
    let current = plants(1)
    api.garden.getState = async () => state(current)
    let changed: (() => void) | undefined
    const unsubscribe = vi.fn()
    api.events.onGardenChanged = (callback) => {
      changed = callback
      return unsubscribe
    }
    const { unmount } = renderPage(api)
    expect(await within(preview()).findAllByRole('img')).toHaveLength(1)

    current = plants(2)
    act(() => changed?.())
    expect(await within(preview()).findByRole('img', { name: current[1].plant })).toBeVisible()
    expect(within(preview()).getAllByRole('img')).toHaveLength(2)

    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
