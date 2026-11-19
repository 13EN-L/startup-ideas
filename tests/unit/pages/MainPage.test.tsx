// Main page layout and navigation (#20 clouds open the result popup)
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { plantImage } from '../../../src/renderer/assets';
import { MainPage, type MainPageProps } from '../../../src/renderer/pages/MainPage';
import { makeCompletedTask } from '../../fixtures';

function setup(overrides: Partial<MainPageProps> = {}) {
  const props: MainPageProps = {
    recentTasks: [makeCompletedTask({ id: 'c1', name: 'Essay' }), makeCompletedTask({ id: 'c2', name: 'Gym' })],
    plants: { work: { category: 'work', totalMinutes: 13 } },
    onOpenTasks: vi.fn(),
    onOpenTaskResult: vi.fn(),
    onOpenGarden: vi.fn(),
    ...overrides,
  };
  render(<MainPage {...props} />);
  return props;
}

describe('MainPage', () => {
  it('shows the FocusGarden title in the sky window', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'FocusGarden' })).toBeInTheDocument();
  });

  it('opens the Task page from the Tasks button', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Tasks' }));
    expect(props.onOpenTasks).toHaveBeenCalled();
  });

  it('#20 clicking a recent-task cloud opens that task result', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Gym' }));
    expect(props.onOpenTaskResult).toHaveBeenCalledWith('c2');
  });

  it('shows a simplified garden that opens the Garden page', async () => {
    const props = setup();
    const garden = screen.getByRole('button', { name: 'Open garden' });
    expect(garden.querySelector('img')).toHaveAttribute('src', plantImage('work', 3));
    await userEvent.click(garden);
    expect(props.onOpenGarden).toHaveBeenCalled();
  });
});
