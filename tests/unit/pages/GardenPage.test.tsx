// Issue #18: Garden page plots, growth images, trophies
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plants } from '../../../src/core/growth';
import { plantImage, trophyImage } from '../../../src/renderer/assets';
import { GardenPage } from '../../../src/renderer/pages/GardenPage';
import { defaultCategories } from '../../../src/core/categories';
import { GROWTH_ANIMATION_DELAY_MS, GROWTH_ANIMATION_MS_PER_MINUTE, PLANTS } from '../../../src/shared/constants';
import type { Category } from '../../../src/shared/types';
import { inCategory, makeCompletedTask } from '../../fixtures';

function renderGarden(
  plants: Plants,
  onNavigateHome = vi.fn(),
  completedTasks = [makeCompletedTask({ name: 'Essay' })],
  loadPlantAbout = vi.fn(async (plant: string): Promise<string | null> => `About the ${plant} plant.`),
  categories: Category[] = defaultCategories(),
) {
  render(
    <GardenPage
      plants={plants}
      categories={categories}
      completedTasks={completedTasks}
      loadPlantAbout={loadPlantAbout}
      onNavigateHome={onNavigateHome}
    />,
  );
  return { onNavigateHome, loadPlantAbout };
}

const allPlants = Object.fromEntries(PLANTS.map((p) => [p.id, { plant: p.id, totalMinutes: 0 }])) as Plants;

describe('#18 GardenPage plots', () => {
  it('only shows plots for plants that have grown from a task', () => {
    renderGarden({ pine: { plant: 'pine', totalMinutes: 3 }, corn: { plant: 'corn', totalMinutes: 0 } });
    expect(screen.getByTestId('plot-pine')).toBeInTheDocument();
    expect(screen.getByTestId('plot-corn')).toBeInTheDocument();
    expect(screen.queryByTestId('plot-tomato')).not.toBeInTheDocument();
  });

  it('uses one row for 5 or fewer plots', () => {
    renderGarden({
      pine: { plant: 'pine', totalMinutes: 1 },
      tomato: { plant: 'tomato', totalMinutes: 1 },
    });
    expect(screen.getAllByTestId(/^plot-row-/)).toHaveLength(1);
  });

  it('puts plots 1-5 in the upper row and 6-10 in the lower row', () => {
    renderGarden(allPlants);
    const rows = screen.getAllByTestId(/^plot-row-/);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getAllByTestId(/^plot-[a-z-]+$/).map((p) => p.dataset.testid)).toEqual(
      PLANTS.slice(0, 5).map((p) => `plot-${p.id}`),
    );
    expect(within(rows[1]).getAllByTestId(/^plot-[a-z-]+$/)).toHaveLength(5);
  });

  it('shows the stage image for the plant type', () => {
    renderGarden({ tomato: { plant: 'tomato', totalMinutes: 25 } }); // stage 5
    const img = within(screen.getByTestId('plot-tomato')).getByRole('img', { name: /Tomato/ });
    expect(img).toHaveAttribute('src', plantImage('tomato', 5));
  });

  it('scales the image up slightly mid-stage', () => {
    renderGarden({
      tomato: { plant: 'tomato', totalMinutes: 24 }, // start of stage 5
      pine: { plant: 'pine', totalMinutes: 27 }, // middle of stage 5
    });
    expect(within(screen.getByTestId('plot-tomato')).getByRole('img')).toHaveStyle({ transform: 'scale(1)' });
    const mid = within(screen.getByTestId('plot-pine')).getByRole('img');
    expect(mid.style.transform).toMatch(/^scale\(1\.0\d+\)$/);
  });

  it('labels each plot with the categories growing it, or the plant name when none does', () => {
    const categories = defaultCategories().map((c) => (c.id === 'media' ? { ...c, plant: 'pine' as const } : c));
    renderGarden(
      { pine: { plant: 'pine', totalMinutes: 1 }, carrot: { plant: 'carrot', totalMinutes: 1 } },
      vi.fn(),
      [],
      undefined,
      categories,
    );
    expect(within(screen.getByTestId('plot-pine')).getByText('Programming, Media')).toBeInTheDocument();
    expect(within(screen.getByTestId('plot-carrot')).getByText('Carrot')).toBeInTheDocument();
  });

  it('shows each plant prestige', () => {
    renderGarden({ pine: { plant: 'pine', totalMinutes: 36 * 2 + 5 } });
    expect(within(screen.getByTestId('plot-pine')).getByText('Prestige 2')).toBeInTheDocument();
  });
});

describe('#18 GardenPage trophies', () => {
  it('shows no trophies at prestige 0', () => {
    renderGarden({ pine: { plant: 'pine', totalMinutes: 10 } });
    expect(screen.queryByRole('img', { name: /trophy/i })).not.toBeInTheDocument();
    expect(screen.getByText('Total prestige: 0')).toBeInTheDocument();
  });

  it('shows the bronze trophy at global prestige 1', () => {
    renderGarden({ pine: { plant: 'pine', totalMinutes: 37 } });
    expect(screen.getByRole('img', { name: 'Bronze trophy' })).toHaveAttribute('src', trophyImage('bronze'));
    expect(screen.queryByRole('img', { name: 'Silver trophy' })).not.toBeInTheDocument();
  });

  it('sums prestige across plants for silver at 10', () => {
    renderGarden({
      pine: { plant: 'pine', totalMinutes: 36 * 5 + 1 }, // 5
      corn: { plant: 'corn', totalMinutes: 36 * 5 + 1 }, // 5
    });
    expect(screen.getByText('Total prestige: 10')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Silver trophy' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Gold trophy' })).not.toBeInTheDocument();
  });

  it('shows gold at 100', () => {
    renderGarden({ pine: { plant: 'pine', totalMinutes: 36 * 100 + 1 } });
    expect(screen.getByRole('img', { name: 'Gold trophy' })).toBeInTheDocument();
  });
});

describe('GardenPage plant task history', () => {
  const T = makeCompletedTask;
  const tasks = [
    T({ id: 'w-old', name: 'Old report', ...inCategory('programming'), endedAt: 1_000 }),
    T({ id: 'gym', name: 'Gym', ...inCategory('geography'), endedAt: 2_000 }),
    T({ id: 'w-new', name: 'New report', ...inCategory('programming'), endedAt: 3_000 }),
  ];
  const plants: Plants = {
    pine: { plant: 'pine', totalMinutes: 10 },
    apple: { plant: 'apple', totalMinutes: 5 },
  };

  it('opens a list of only that plant\'s tasks, newest first, when a plant is clicked', async () => {
    renderGarden(plants, vi.fn(), tasks);
    await userEvent.click(screen.getByRole('button', { name: 'Pine tasks' }));
    const list = screen.getByRole('list', { name: 'Pine tasks' });
    expect(within(list).getAllByRole('button').map((b) => b.querySelector('.task-history__name')?.textContent)).toEqual([
      'New report',
      'Old report',
    ]);
  });

  it('opens a task\'s statistics on top of the list, and Escape closes only the top popup', async () => {
    renderGarden(plants, vi.fn(), tasks);
    await userEvent.click(screen.getByRole('button', { name: 'Pine tasks' }));
    await userEvent.click(screen.getByRole('button', { name: /Old report/ }));
    expect(screen.getByRole('dialog', { name: 'Old report' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Pine tasks' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Old report' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Pine tasks' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the plant\'s growth and its description above the list', async () => {
    const { loadPlantAbout } = renderGarden({ pine: { plant: 'pine', totalMinutes: 36 + 9 } }, vi.fn(), tasks);
    await userEvent.click(screen.getByRole('button', { name: 'Pine tasks' }));
    const dialog = screen.getByRole('dialog', { name: 'Pine tasks' });
    expect(within(dialog).getByText('45 min')).toBeInTheDocument();
    expect(within(dialog).getByText('Prestige').nextSibling).toHaveTextContent('1');
    expect(await within(dialog).findByText('About the pine plant.')).toBeInTheDocument();
    expect(loadPlantAbout).toHaveBeenCalledWith('pine');
  });

  it('keeps tasks with the plant they grew after their category moves to another plant', async () => {
    const moved = defaultCategories().map((c) => (c.id === 'programming' ? { ...c, plant: 'carrot' as const } : c));
    const withNew = [...tasks, T({ id: 'w-moved', name: 'After the move', ...inCategory('programming'), plant: 'carrot' })];
    renderGarden({ ...plants, carrot: { plant: 'carrot', totalMinutes: 3 } }, vi.fn(), withNew, undefined, moved);
    await userEvent.click(screen.getByRole('button', { name: 'Pine tasks' }));
    const pine = screen.getByRole('list', { name: 'Pine tasks' });
    expect(within(pine).queryByText('After the move')).not.toBeInTheDocument();
    expect(within(pine).getByText('Old report')).toBeInTheDocument();
    expect(screen.getByText(/No category grows this plant right now/)).toBeInTheDocument();
  });

  it('still opens the list when the description can\'t be loaded', async () => {
    renderGarden(plants, vi.fn(), tasks, vi.fn(async () => Promise.reject(new Error('missing'))));
    await userEvent.click(screen.getByRole('button', { name: 'Pine tasks' }));
    expect(await screen.findByRole('list', { name: 'Pine tasks' })).toBeInTheDocument();
  });

  it('starts with no task open when the list is reopened', async () => {
    renderGarden(plants, vi.fn(), tasks);
    await userEvent.click(screen.getByRole('button', { name: 'Pine tasks' }));
    await userEvent.click(screen.getByRole('button', { name: /New report/ }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'New report' })).getByRole('button', { name: 'Close' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Pine tasks' })).getByRole('button', { name: 'Close' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pine tasks' }));
    expect(screen.queryByRole('dialog', { name: 'New report' })).not.toBeInTheDocument();
  });
});

describe('GardenPage chrome', () => {
  it('has decorative conveyor clouds without task names', () => {
    renderGarden({});
    const clouds = screen.getByTestId('decorative-clouds');
    expect(clouds).toHaveClass('clouds--conveyor');
    expect(clouds).toHaveTextContent('');
    expect(screen.queryByText('Essay')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recent tasks' })).not.toBeInTheDocument();
  });

  it('navigates home', async () => {
    const { onNavigateHome } = renderGarden({});
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onNavigateHome).toHaveBeenCalled();
  });
});

describe('GardenPage growth replay', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  const carrot = () => within(screen.getByTestId('plot-carrot'));
  /** 40 productive minutes on a seed nobody has looked at yet. */
  const unviewedCarrot: Plants = { carrot: { plant: 'carrot', totalMinutes: 40, viewedMinutes: 0 } };

  it('opens on the growth last seen, not the new total', () => {
    renderGarden(unviewedCarrot);
    expect(carrot().getByRole('img')).toHaveAccessibleName('Carrot, stage 1');
    expect(carrot().getByRole('img')).toHaveStyle({ transform: 'scale(1)' });
    expect(carrot().queryByText(/Prestige/)).not.toBeInTheDocument();
  });

  it('grows through the stages, wraps to stage 1 with +1 prestige, and stops at the new total', () => {
    renderGarden(unviewedCarrot);
    advance(GROWTH_ANIMATION_DELAY_MS + 20 * GROWTH_ANIMATION_MS_PER_MINUTE); // 20 minutes in
    expect(carrot().getByRole('img')).toHaveAccessibleName('Carrot, stage 4');
    expect(carrot().getByRole('img')).toHaveAttribute('src', plantImage('carrot', 4));
    expect(screen.getByText('Total prestige: 0')).toBeInTheDocument();

    advance(20 * GROWTH_ANIMATION_MS_PER_MINUTE + 100);
    expect(carrot().getByRole('img')).toHaveAccessibleName('Carrot, stage 1');
    expect(carrot().getByText('Prestige 1')).toBeInTheDocument();
    expect(screen.getByText('Total prestige: 1')).toBeInTheDocument();
    // 4 minutes into the new cycle: two thirds of the way through stage 1.
    expect(Number(/scale\((.+)\)/.exec(carrot().getByRole('img').style.transform)?.[1])).toBeCloseTo(1.1);

    const settled = carrot().getByRole('img').outerHTML;
    advance(10_000);
    expect(carrot().getByRole('img').outerHTML).toBe(settled);
  });

  it('marks unseen growth as viewed so it only replays once', () => {
    const onPlantsViewed = vi.fn();
    render(
      <GardenPage categories={defaultCategories()} plants={unviewedCarrot} completedTasks={[]} loadPlantAbout={async () => null} onNavigateHome={() => {}} onPlantsViewed={onPlantsViewed} />,
    );
    expect(onPlantsViewed).toHaveBeenCalledTimes(1);
  });

  it('keeps replaying after the plants are marked viewed', () => {
    const { rerender } = render(
      <GardenPage categories={defaultCategories()} plants={unviewedCarrot} completedTasks={[]} loadPlantAbout={async () => null} onNavigateHome={() => {}} />,
    );
    advance(GROWTH_ANIMATION_DELAY_MS + 10 * GROWTH_ANIMATION_MS_PER_MINUTE);
    rerender(
      <GardenPage
        categories={defaultCategories()}
        plants={{ carrot: { plant: 'carrot', totalMinutes: 40, viewedMinutes: 40 } }}
        completedTasks={[]}
        loadPlantAbout={async () => null}
        onNavigateHome={() => {}}
      />,
    );
    expect(carrot().getByRole('img')).toHaveAccessibleName('Carrot, stage 2');
    advance(30 * GROWTH_ANIMATION_MS_PER_MINUTE + 100);
    expect(carrot().getByText('Prestige 1')).toBeInTheDocument();
  });

  it('does not replay growth that has already been seen', () => {
    const onPlantsViewed = vi.fn();
    render(
      <GardenPage
        categories={defaultCategories()}
        plants={{ carrot: { plant: 'carrot', totalMinutes: 40 } }}
        completedTasks={[]}
        loadPlantAbout={async () => null}
        onNavigateHome={() => {}}
        onPlantsViewed={onPlantsViewed}
      />,
    );
    expect(carrot().getByRole('img')).toHaveAccessibleName('Carrot, stage 1');
    expect(carrot().getByText('Prestige 1')).toBeInTheDocument();
    expect(onPlantsViewed).not.toHaveBeenCalled();
  });

  it('shows the new growth straight away when the system asks for reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    renderGarden(unviewedCarrot);
    expect(carrot().getByText('Prestige 1')).toBeInTheDocument();
  });
});
