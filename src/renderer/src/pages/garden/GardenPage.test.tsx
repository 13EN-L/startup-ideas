// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FocusGardenApi, GardenState } from '../../../../shared/api'
import { plantImage, trophyImage, ui } from '../../../assets/manifest'
import { createMockApi } from '../../api/mockApi'
import { ApiProvider } from '../../api/useApi'
import { GardenPage } from '../GardenPage'
import { sampleGarden } from './fixtures'

function apiWith(states: GardenState[]): {
  api: FocusGardenApi
  getState: ReturnType<typeof vi.fn>
  fireGardenChanged: () => void
} {
  const base = createMockApi()
  const listeners = new Set<() => void>()
  let call = 0
  const getState = vi.fn(async () => structuredClone(states[Math.min(call++, states.length - 1)]))
  const api: FocusGardenApi = {
    ...base,
    garden: { getState },
    events: {
      ...base.events,
      onGardenChanged(callback) {
        listeners.add(callback)
        return () => listeners.delete(callback)
      }
    }
  }
  return { api, getState, fireGardenChanged: () => listeners.forEach((l) => l()) }
}

function renderGarden(
  state: GardenState,
  navigate = vi.fn()
): ReturnType<typeof render> & { navigate: ReturnType<typeof vi.fn> } {
  const { api } = apiWith([state])
  return {
    ...render(
      <ApiProvider api={api}>
        <GardenPage navigate={navigate} />
      </ApiProvider>
    ),
    navigate
  }
}

async function plots(): Promise<HTMLElement[]> {
  await waitFor(() => expect(screen.getByTestId('grass')).toHaveAttribute('data-loaded', 'true'))
  return screen.queryAllByTestId('plot')
}

const rowOf = (plot: HTMLElement): string | undefined =>
  plot.closest<HTMLElement>('[data-testid="plot-row"]')?.dataset.row

describe('GardenPage', () => {
  it('is the garden page landmark with the sky on the top third', async () => {
    renderGarden(sampleGarden(3))
    expect(screen.getByRole('main', { name: 'Garden page' })).toBeInTheDocument()
    expect(screen.getByTestId('sky')).toHaveStyle({ height: `${(1 / 3) * 100}%` })
    await plots()
  })

  it('shows only grass and a quiet hint with no plants', async () => {
    renderGarden(sampleGarden(0))
    expect(await plots()).toHaveLength(0)
    expect(screen.queryAllByTestId('plot-row')).toHaveLength(0)
    expect(screen.getByText('Finish a task to plant your first seed.')).toBeInTheDocument()
  })

  it.each([1, 3, 5])('puts %i plants in one row', async (count) => {
    renderGarden(sampleGarden(count))
    const all = await plots()
    expect(all).toHaveLength(count)
    expect(all.every((p) => rowOf(p) === '1')).toBe(true)
    expect(screen.getByTestId('grass')).toHaveAttribute('data-rows', '1')
    expect(screen.queryByText('Finish a task to plant your first seed.')).not.toBeInTheDocument()
  })

  it.each([6, 10])('splits %i plants into two rows of up to 5', async (count) => {
    renderGarden(sampleGarden(count))
    const all = await plots()
    expect(all).toHaveLength(count)
    expect(screen.getByTestId('grass')).toHaveAttribute('data-rows', '2')
    expect(all.slice(0, 5).map(rowOf)).toEqual(['1', '1', '1', '1', '1'])
    expect(all.slice(5).every((p) => rowOf(p) === '2')).toBe(true)
  })

  it('sizes plots by how many there are, the same in both rows', async () => {
    const { unmount } = renderGarden(sampleGarden(3))
    const three = await plots()
    expect(three.map((p) => p.style.getPropertyValue('--plots'))).toEqual(['3', '3', '3'])
    unmount()
    renderGarden(sampleGarden(6))
    const six = await plots()
    expect(six.map((p) => p.style.getPropertyValue('--plots'))).toEqual(Array(6).fill('5'))
  })

  it('places plants in position order', async () => {
    const state = sampleGarden(3)
    state.plants.reverse()
    renderGarden(state)
    const all = await plots()
    expect(all.map((p) => p.dataset.position)).toEqual(['1', '2', '3'])
    expect(all.map((p) => p.dataset.category)).toEqual([
      'Work',
      'School / Study',
      'Health & Fitness'
    ])
  })

  it('draws each plant at its stage and scale', async () => {
    const state = sampleGarden(1)
    state.plants[0] = { ...state.plants[0], stage: 4, scale: 1.033 }
    renderGarden(state)
    const [plot] = await plots()
    const img = within(plot).getByTestId('plant')
    expect(img).toHaveAttribute('src', plantImage('Pine', 4))
    expect(img).toHaveAttribute('alt', 'Pine, stage 4')
    expect(img.style.transform).toBe('scale(1.033)')
  })

  it('shows each plot’s prestige count in its corner', async () => {
    const state = sampleGarden(2)
    state.plants[1].prestige = 7
    renderGarden(state)
    const all = await plots()
    expect(within(all[0]).getByTestId('prestige')).toHaveTextContent('0')
    expect(within(all[1]).getByTestId('prestige')).toHaveTextContent('7')
    expect(within(all[1]).getByTestId('prestige')).toHaveAccessibleName('prestige 7')
  })

  it('labels each plot with its category on a sign', async () => {
    renderGarden(sampleGarden(2))
    const all = await plots()
    expect(within(all[0]).getByTestId('plot-sign')).toHaveTextContent('Work')
    expect(within(all[1]).getByTestId('plot-sign')).toHaveTextContent('School / Study')
  })

  it('opens a progress popup when a plant is clicked', async () => {
    const state = sampleGarden(1)
    state.plants[0] = {
      ...state.plants[0],
      category: 'Relationships',
      plant: 'Sunflower',
      stage: 1,
      prestige: 0,
      totalSeconds: 353.952,
      progress: 353.952 / 360,
      secondsIntoStage: 353.952
    }
    renderGarden(state)
    await plots()
    await userEvent.click(screen.getByRole('button', { name: 'Sunflower, Relationships, stage 1' }))

    const popup = screen.getByRole('dialog', { name: 'Sunflower' })
    expect(within(popup).getByRole('heading', { name: 'Sunflower' })).toBeInTheDocument()
    expect(popup).toHaveTextContent('Relationships')
    expect(popup).toHaveTextContent('Stage 1 of 6')
    expect(popup).toHaveTextContent('5:53 / 6:00')
    expect(popup).toHaveTextContent('Total grown: 5m 53s')
    expect(popup).toHaveTextContent('Prestige: 0')
    const bar = within(popup).getByRole('progressbar', { name: 'progress to the next stage' })
    expect(bar).toHaveAttribute('aria-valuenow', '98')
    expect(within(bar).getByTestId('stage-fill').style.width).toBe('98%')
  })

  it('says a new cycle comes next in the last stage', async () => {
    const state = sampleGarden(1)
    state.plants[0] = { ...state.plants[0], stage: 6, prestige: 2, secondsIntoStage: 60 }
    renderGarden(state)
    await plots()
    await userEvent.click(screen.getByRole('button', { name: 'Pine, Work, stage 6' }))
    const popup = screen.getByRole('dialog', { name: 'Pine' })
    expect(popup).toHaveTextContent('Stage 6 of 6')
    expect(popup).toHaveTextContent('1:00 / 6:00 to a new cycle')
    expect(popup).toHaveTextContent('Prestige: 2')
  })

  it('closes the progress popup', async () => {
    renderGarden(sampleGarden(1))
    await plots()
    await userEvent.click(screen.getByRole('button', { name: /^Pine, Work/ }))
    await userEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([
    [0, []],
    [1, ['bronze']],
    [10, ['bronze', 'silver']],
    [100, ['bronze', 'silver', 'gold']]
  ] as const)('at global prestige %i shows trophies %j in order', async (prestige, expected) => {
    renderGarden(sampleGarden(3, prestige))
    await plots()
    const shelf = screen.getByTestId('trophies')
    const imgs = within(shelf).queryAllByRole('img')
    expect(imgs.map((i) => i.getAttribute('alt'))).toEqual(expected.map((t) => `${t} trophy`))
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(expected.map((t) => trophyImage(t)))
  })

  it('orders trophies bronze, silver, gold whatever order they arrive in', async () => {
    renderGarden({
      ...sampleGarden(1),
      globalPrestige: 100,
      trophies: ['gold', 'bronze', 'silver']
    })
    await plots()
    const alts = within(screen.getByTestId('trophies'))
      .getAllByRole('img')
      .map((i) => i.getAttribute('alt'))
    expect(alts).toEqual(['bronze trophy', 'silver trophy', 'gold trophy'])
  })

  it('shows the logo in the sky above the trophies', async () => {
    renderGarden(sampleGarden(1, 1))
    await plots()
    const logo = screen.getByRole('img', { name: 'FocusGarden' })
    expect(logo).toHaveAttribute('src', ui.logo)
    expect(screen.getByTestId('sky')).toContainElement(logo)
    expect(logo.compareDocumentPosition(screen.getByTestId('trophies'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('has 5 decorative clouds that aren’t clickable', async () => {
    renderGarden(sampleGarden(3))
    await plots()
    const clouds = within(screen.getByTestId('sky')).getAllByTestId('cloud')
    expect(clouds).toHaveLength(5)
    for (const cloud of clouds) {
      expect(cloud.tagName).not.toBe('BUTTON')
      expect(cloud).toHaveAttribute('aria-hidden', 'true')
      expect(cloud).toHaveTextContent('')
    }
  })

  it('goes to the main page from the always-active home sign', async () => {
    const { navigate } = renderGarden(sampleGarden(3))
    await plots()
    const sign = screen.getByRole('button', { name: 'home' })
    expect(sign).toBeEnabled()
    await userEvent.click(sign)
    expect(navigate).toHaveBeenCalledWith({ page: 'main' })
  })

  it('loads once on mount and reloads only when the garden changes', async () => {
    const { api, getState, fireGardenChanged } = apiWith([sampleGarden(1), sampleGarden(2)])
    render(
      <ApiProvider api={api}>
        <GardenPage navigate={vi.fn()} />
      </ApiProvider>
    )
    expect(await plots()).toHaveLength(1)
    expect(getState).toHaveBeenCalledTimes(1)
    await act(async () => fireGardenChanged())
    expect(await screen.findAllByTestId('plot')).toHaveLength(2)
    expect(getState).toHaveBeenCalledTimes(2)
  })

  it('stops listening for garden changes when it unmounts', async () => {
    const { api, getState, fireGardenChanged } = apiWith([sampleGarden(1)])
    const { unmount } = render(
      <ApiProvider api={api}>
        <GardenPage navigate={vi.fn()} />
      </ApiProvider>
    )
    await plots()
    unmount()
    fireGardenChanged()
    expect(getState).toHaveBeenCalledTimes(1)
  })
})
