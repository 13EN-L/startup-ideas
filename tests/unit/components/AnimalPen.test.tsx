// Issue #19: animal pen, nametags, stop popup and walk-out animation
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { animalImage } from '../../../src/renderer/assets';
import { AnimalPen } from '../../../src/renderer/components/AnimalPen';
import { makeActiveTask, T0 } from '../../fixtures';

const tasks = [
  makeActiveTask({ id: 'a', name: 'Essay', animal: 'cow', slot: 0, startedAt: T0 }),
  makeActiveTask({ id: 'b', name: 'Taxes', animal: 'duck', slot: 2, startedAt: T0 - 3600_000 }),
];
const NOW = T0 + 12 * 60_000 + 5_000;

function setup(activeTasks = tasks) {
  const onStopTask = vi.fn();
  render(<AnimalPen activeTasks={activeTasks} now={NOW} onStopTask={onStopTask} />);
  return { onStopTask, pen: screen.getByRole('region', { name: 'Animal pen' }) };
}

describe('#19 AnimalPen', () => {
  it('renders one animal per active task with its image and nametag', () => {
    const { pen } = setup();
    const cow = within(pen).getByRole('button', { name: 'Essay (cow)' });
    expect(within(cow).getByRole('img')).toHaveAttribute('src', animalImage('cow'));
    expect(cow).toHaveTextContent('Essay');
    expect(within(pen).getByRole('button', { name: 'Taxes (duck)' })).toBeInTheDocument();
  });

  it('places each animal in its own third of the pen', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Essay (cow)' })).toHaveAttribute('data-slot', '0');
    expect(screen.getByRole('button', { name: 'Taxes (duck)' })).toHaveAttribute('data-slot', '2');
  });

  it('animates idle animals walking side to side', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Essay (cow)' })).toHaveAttribute('data-state', 'walking');
  });

  it('renders an empty pen with a closed gate', () => {
    const { pen } = setup([]);
    expect(within(pen).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('pen-gate')).toHaveAttribute('data-open', 'false');
  });

  it('opens a popup with elapsed time and a Stop button when an animal is clicked', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Essay (cow)' }));
    const dialog = screen.getByRole('dialog', { name: 'Essay' });
    expect(dialog).toHaveTextContent('12:05');
    expect(within(dialog).getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('shows hours for long-running tasks', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Taxes (duck)' }));
    expect(screen.getByRole('dialog', { name: 'Taxes' })).toHaveTextContent('1:12:05');
  });

  it('closes the popup without stopping the task', async () => {
    const user = userEvent.setup();
    const { onStopTask } = setup();
    await user.click(screen.getByRole('button', { name: 'Essay (cow)' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onStopTask).not.toHaveBeenCalled();
  });

  it('on Stop, opens the gate and walks the animal out before freeing the slot', async () => {
    const user = userEvent.setup();
    const { onStopTask } = setup();
    await user.click(screen.getByRole('button', { name: 'Essay (cow)' }));
    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('pen-gate')).toHaveAttribute('data-open', 'true');
    const cow = screen.getByRole('button', { name: 'Essay (cow)' });
    expect(cow).toHaveAttribute('data-state', 'exiting');
    expect(onStopTask).not.toHaveBeenCalled();

    fireEvent.animationEnd(cow);
    expect(onStopTask).toHaveBeenCalledWith('a', NOW);
  });

  it('ignores clicks on an animal that is already leaving', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Essay (cow)' }));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await user.click(screen.getByRole('button', { name: 'Essay (cow)' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
