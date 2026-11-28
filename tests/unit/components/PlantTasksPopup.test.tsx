// Garden plot click: the full history of the tasks that grew the plant
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defaultCategories } from '../../../src/core/categories';
import { PlantTasksPopup, type PlantTasksPopupProps } from '../../../src/renderer/components/PlantTasksPopup';
import { inCategory, makeCompletedTask } from '../../fixtures';

const tasks = [
  makeCompletedTask({
    id: 'w2',
    name: 'Quarterly report',
    ...inCategory('programming'),
    metrics: { productiveSeconds: 1450, unproductiveSeconds: 0, idleSeconds: 0 },
  }),
  makeCompletedTask({ id: 'w1', name: 'Inbox zero', ...inCategory('programming') }),
];

function setup(overrides: Partial<PlantTasksPopupProps> = {}) {
  const props: PlantTasksPopupProps = {
    plant: 'pine',
    categories: defaultCategories(),
    totalMinutes: 0,
    tasks,
    onSelectTask: () => {},
    onClose: () => {},
    ...overrides,
  };
  return render(<PlantTasksPopup {...props} />);
}

describe('PlantTasksPopup', () => {
  it('is a dialog named after the plant, showing the categories growing it and the task count', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Pine tasks' });
    expect(within(dialog).getByText('Grown by Programming · 2 completed')).toBeInTheDocument();
  });

  it('lists every category sharing the plant', () => {
    const categories = defaultCategories().map((c) => (c.id === 'media' ? { ...c, plant: 'pine' as const } : c));
    setup({ categories });
    expect(screen.getByText('Grown by Programming, Media · 2 completed')).toBeInTheDocument();
  });

  it('says when no category grows the plant any more', () => {
    const categories = defaultCategories().map((c) => (c.plant === 'pine' ? { ...c, plant: null } : c));
    setup({ categories });
    expect(screen.getByText('No category grows this plant right now · 2 completed')).toBeInTheDocument();
  });

  it('lists every task in the given order with its category, date and on-task time', () => {
    setup();
    const items = within(screen.getByRole('list', { name: 'Pine tasks' })).getAllByRole('button');
    expect(items.map((b) => b.querySelector('.task-history__name')?.textContent)).toEqual(['Quarterly report', 'Inbox zero']);
    expect(items[0]).toHaveTextContent('24:10 on task');
    expect(items[0]).toHaveTextContent('Programming · ');
    expect(items[0]).toHaveTextContent('2026');
  });

  it("shows a removed category's saved name on its old tasks", () => {
    setup({ categories: [{ id: 'other', label: 'Other', plant: 'pine' }] });
    expect(screen.getByRole('button', { name: /Inbox zero/ })).toHaveTextContent('Programming · ');
  });

  it('reports which task was clicked', async () => {
    const onSelectTask = vi.fn();
    setup({ onSelectTask });
    await userEvent.click(screen.getByRole('button', { name: /Inbox zero/ }));
    expect(onSelectTask).toHaveBeenCalledWith('w1');
  });

  it('closes with the Close button or Escape', async () => {
    const onClose = vi.fn();
    setup({ onClose });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores Escape while another popup is on top', async () => {
    const onClose = vi.fn();
    setup({ onClose, active: false });
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says so when there are no tasks', () => {
    setup({ plant: 'lilac', tasks: [] });
    expect(screen.getByText('No completed tasks yet.')).toBeInTheDocument();
  });
});

describe('PlantTasksPopup: plant growth', () => {
  const stat = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

  it('shows focus time, stage, growth and prestige for the plant', () => {
    // 2 full cycles (72 min) + 20 min: prestige 2, stage 4 of 6, 20/36 = 55% grown.
    setup({ totalMinutes: 92 });
    expect(stat('Focus time')).toBe('1 h 32 min');
    expect(stat('Stage')).toBe('4 of 6');
    expect(stat('Growth')).toBe('55%');
    expect(stat('Prestige')).toBe('2');
    expect(screen.getByRole('progressbar', { name: 'Growth this cycle' })).toHaveAttribute('aria-valuenow', '55');
  });

  it('shows a full-grown plant at exactly 36 minutes as 100% without prestige', () => {
    setup({ totalMinutes: 36 });
    expect(stat('Stage')).toBe('6 of 6');
    expect(stat('Growth')).toBe('100%');
    expect(stat('Prestige')).toBe('0');
  });

  it('shows the plant description above the task list', () => {
    setup({ totalMinutes: 10, about: 'Pines are evergreen.' });
    const about = screen.getByText('Pines are evergreen.');
    const list = screen.getByRole('list', { name: 'Pine tasks' });
    expect(about.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leaves the description out when there is none', () => {
    const { container } = setup({ totalMinutes: 10, about: null });
    expect(container.querySelector('.plant-about')).toBeNull();
  });
});
