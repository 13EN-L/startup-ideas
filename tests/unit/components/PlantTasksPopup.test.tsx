// Garden plot click: the category's full task history
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlantTasksPopup } from '../../../src/renderer/components/PlantTasksPopup';
import { makeCompletedTask } from '../../fixtures';

const tasks = [
  makeCompletedTask({ id: 'w2', name: 'Quarterly report', category: 'work', metrics: { productiveSeconds: 1450, unproductiveSeconds: 0, idleSeconds: 0 } }),
  makeCompletedTask({ id: 'w1', name: 'Inbox zero', category: 'work' }),
];

describe('PlantTasksPopup', () => {
  it('is a dialog named after the category, showing the plant and task count', () => {
    render(<PlantTasksPopup category="work" tasks={tasks} onSelectTask={() => {}} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Work tasks' });
    expect(within(dialog).getByText('Pine · 2 completed')).toBeInTheDocument();
  });

  it('lists every task in the given order with its date and on-task time', () => {
    render(<PlantTasksPopup category="work" tasks={tasks} onSelectTask={() => {}} onClose={() => {}} />);
    const items = within(screen.getByRole('list', { name: 'Work tasks' })).getAllByRole('button');
    expect(items.map((b) => b.querySelector('.task-history__name')?.textContent)).toEqual(['Quarterly report', 'Inbox zero']);
    expect(items[0]).toHaveTextContent('24:10 on task');
    expect(items[0]).toHaveTextContent('2026');
  });

  it('reports which task was clicked', async () => {
    const onSelectTask = vi.fn();
    render(<PlantTasksPopup category="work" tasks={tasks} onSelectTask={onSelectTask} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Inbox zero/ }));
    expect(onSelectTask).toHaveBeenCalledWith('w1');
  });

  it('closes with the Close button or Escape', async () => {
    const onClose = vi.fn();
    render(<PlantTasksPopup category="work" tasks={tasks} onSelectTask={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores Escape while another popup is on top', async () => {
    const onClose = vi.fn();
    render(<PlantTasksPopup category="work" tasks={tasks} onSelectTask={() => {}} onClose={onClose} active={false} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says so when there are no tasks', () => {
    render(<PlantTasksPopup category="finance" tasks={[]} onSelectTask={() => {}} onClose={() => {}} />);
    expect(screen.getByText('No completed tasks yet.')).toBeInTheDocument();
  });
});
