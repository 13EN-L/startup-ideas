// Issue #18: Garden page plots, growth images, trophies
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Plants } from '../../../src/core/growth';
import { plantImage, trophyImage } from '../../../src/renderer/assets';
import { GardenPage } from '../../../src/renderer/pages/GardenPage';
import { CATEGORIES } from '../../../src/shared/constants';
import { makeCompletedTask } from '../../fixtures';

function renderGarden(plants: Plants, onNavigateHome = vi.fn()) {
  render(<GardenPage plants={plants} recentTasks={[makeCompletedTask({ name: 'Essay' })]} onNavigateHome={onNavigateHome} />);
  return { onNavigateHome };
}

const allPlants = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, { category: c.id, totalMinutes: 0 }]),
) as Plants;

describe('#18 GardenPage plots', () => {
  it('only shows plots for categories with a completed task', () => {
    renderGarden({ work: { category: 'work', totalMinutes: 3 }, home: { category: 'home', totalMinutes: 0 } });
    expect(screen.getByTestId('plot-work')).toBeInTheDocument();
    expect(screen.getByTestId('plot-home')).toBeInTheDocument();
    expect(screen.queryByTestId('plot-school')).not.toBeInTheDocument();
  });

  it('uses one row for 5 or fewer plots', () => {
    renderGarden({
      work: { category: 'work', totalMinutes: 1 },
      school: { category: 'school', totalMinutes: 1 },
    });
    expect(screen.getAllByTestId(/^plot-row-/)).toHaveLength(1);
  });

  it('puts plots 1-5 in the upper row and 6-10 in the lower row', () => {
    renderGarden(allPlants);
    const rows = screen.getAllByTestId(/^plot-row-/);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getAllByTestId(/^plot-[a-z-]+$/).map((p) => p.dataset.testid)).toEqual(
      CATEGORIES.slice(0, 5).map((c) => `plot-${c.id}`),
    );
    expect(within(rows[1]).getAllByTestId(/^plot-[a-z-]+$/)).toHaveLength(5);
  });

  it('shows the stage image for the plant type', () => {
    renderGarden({ school: { category: 'school', totalMinutes: 25 } }); // stage 5
    const img = within(screen.getByTestId('plot-school')).getByRole('img', { name: /Tomato/ });
    expect(img).toHaveAttribute('src', plantImage('school', 5));
  });

  it('scales the image up slightly mid-stage', () => {
    renderGarden({
      school: { category: 'school', totalMinutes: 24 }, // start of stage 5
      work: { category: 'work', totalMinutes: 27 }, // middle of stage 5
    });
    expect(within(screen.getByTestId('plot-school')).getByRole('img')).toHaveStyle({ transform: 'scale(1)' });
    const mid = within(screen.getByTestId('plot-work')).getByRole('img');
    expect(mid.style.transform).toMatch(/^scale\(1\.0\d+\)$/);
  });

  it('shows each plant prestige', () => {
    renderGarden({ work: { category: 'work', totalMinutes: 36 * 2 + 5 } });
    expect(within(screen.getByTestId('plot-work')).getByText('Prestige 2')).toBeInTheDocument();
  });
});

describe('#18 GardenPage trophies', () => {
  it('shows no trophies at prestige 0', () => {
    renderGarden({ work: { category: 'work', totalMinutes: 10 } });
    expect(screen.queryByRole('img', { name: /trophy/i })).not.toBeInTheDocument();
    expect(screen.getByText('Total prestige: 0')).toBeInTheDocument();
  });

  it('shows the bronze trophy at global prestige 1', () => {
    renderGarden({ work: { category: 'work', totalMinutes: 37 } });
    expect(screen.getByRole('img', { name: 'Bronze trophy' })).toHaveAttribute('src', trophyImage('bronze'));
    expect(screen.queryByRole('img', { name: 'Silver trophy' })).not.toBeInTheDocument();
  });

  it('sums prestige across plants for silver at 10', () => {
    renderGarden({
      work: { category: 'work', totalMinutes: 36 * 5 + 1 }, // 5
      home: { category: 'home', totalMinutes: 36 * 5 + 1 }, // 5
    });
    expect(screen.getByText('Total prestige: 10')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Silver trophy' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Gold trophy' })).not.toBeInTheDocument();
  });

  it('shows gold at 100', () => {
    renderGarden({ work: { category: 'work', totalMinutes: 36 * 100 + 1 } });
    expect(screen.getByRole('img', { name: 'Gold trophy' })).toBeInTheDocument();
  });
});

describe('GardenPage chrome', () => {
  it('moves the clouds like a conveyor belt', () => {
    renderGarden({});
    expect(screen.getByRole('list', { name: 'Recent tasks' })).toHaveAttribute('data-motion', 'conveyor');
  });

  it('navigates home', async () => {
    const { onNavigateHome } = renderGarden({});
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onNavigateHome).toHaveBeenCalled();
  });
});
