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
    render(<PlantTasksPopup category="work" totalMinutes={0} tasks={tasks} onSelectTask={() => {}} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Work tasks' });
    expect(within(dialog).getByText('Pine · 2 completed')).toBeInTheDocument();
  });

  it('lists every task in the given order with its date and on-task time', () => {
    render(<PlantTasksPopup category="work" totalMinutes={0} tasks={tasks} onSelectTask={() => {}} onClose={() => {}} />);
    const items = within(screen.getByRole('list', { name: 'Work tasks' })).getAllByRole('button');
    expect(items.map((b) => b.querySelector('.task-history__name')?.textContent)).toEqual(['Quarterly report', 'Inbox zero']);
    expect(items[0]).toHaveTextContent('24:10 on task');
    expect(items[0]).toHaveTextContent('2026');
  });

  it('reports which task was clicked', async () => {
    const onSelectTask = vi.fn();
    render(<PlantTasksPopup category="work" totalMinutes={0} tasks={tasks} onSelectTask={onSelectTask} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Inbox zero/ }));
    expect(onSelectTask).toHaveBeenCalledWith('w1');
  });

  it('closes with the Close button or Escape', async () => {
    const onClose = vi.fn();
    render(<PlantTasksPopup category="work" totalMinutes={0} tasks={tasks} onSelectTask={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores Escape while another popup is on top', async () => {
    const onClose = vi.fn();
    render(<PlantTasksPopup category="work" totalMinutes={0} tasks={tasks} onSelectTask={() => {}} onClose={onClose} active={false} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says so when there are no tasks', () => {
    render(<PlantTasksPopup category="finance" totalMinutes={0} tasks={[]} onSelectTask={() => {}} onClose={() => {}} />);
    expect(screen.getByText('No completed tasks yet.')).toBeInTheDocument();
  });
});

describe('PlantTasksPopup: plant growth', () => {
  const stat = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

  it('shows focus time, stage, growth and prestige for the plant', () => {
    // 2 full cycles (72 min) + 20 min: prestige 2, stage 4 of 6, 20/36 = 55% grown.
    render(<PlantTasksPopup category="work" totalMinutes={92} tasks={tasks} onSelectTask={() => {}} onClose={() => {}} />);
    expect(stat('Focus time')).toBe('1 h 32 min');
    expect(stat('Stage')).toBe('4 of 6');
    expect(stat('Growth')).toBe('55%');
    expect(stat('Prestige')).toBe('2');
    expect(screen.getByRole('progressbar', { name: 'Growth this cycle' })).toHaveAttribute('aria-valuenow', '55');
  });

  it('shows a full-grown plant at exactly 36 minutes as 100% without prestige', () => {
    render(<PlantTasksPopup category="work" totalMinutes={36} tasks={tasks} onSelectTask={() => {}} onClose={() => {}} />);
    expect(stat('Stage')).toBe('6 of 6');
    expect(stat('Growth')).toBe('100%');
    expect(stat('Prestige')).toBe('0');
  });

  it('shows the plant description above the task list', () => {
    render(
      <PlantTasksPopup category="work" totalMinutes={10} about="Pines are evergreen." tasks={tasks} onSelectTask={() => {}} onClose={() => {}} />,
    );
    const about = screen.getByText('Pines are evergreen.');
    const list = screen.getByRole('list', { name: 'Work tasks' });
    expect(about.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves the description out when there is none', () => {
    const { container } = render(
      <PlantTasksPopup category="work" totalMinutes={10} about={null} tasks={tasks} onSelectTask={() => {}} onClose={() => {}} />,
    );
    expect(container.querySelector('.plant-about')).toBeNull();
  });
});
