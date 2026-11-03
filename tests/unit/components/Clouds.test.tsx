// Issue #20: recent task clouds
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CLOUD_IMAGE } from '../../../src/renderer/assets';
import { Clouds } from '../../../src/renderer/components/Clouds';
import { makeCompletedTask } from '../../fixtures';

const tasks = Array.from({ length: 7 }, (_, i) => makeCompletedTask({ id: `c${i}`, name: `Task ${i}` }));

describe('#20 Clouds', () => {
  it('renders at most 5 clouds labelled with task names, in the given order', () => {
    render(<Clouds tasks={tasks} onSelect={() => {}} />);
    const list = screen.getByRole('list', { name: 'Recent tasks' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items.map((li) => li.textContent)).toEqual(['Task 0', 'Task 1', 'Task 2', 'Task 3', 'Task 4']);
  });

  it('uses the cloud placeholder image', () => {
    const { container } = render(<Clouds tasks={tasks.slice(0, 1)} onSelect={() => {}} />);
    expect(container.querySelector('img')).toHaveAttribute('src', CLOUD_IMAGE);
  });

  it('reports which task was clicked', async () => {
    const onSelect = vi.fn();
    render(<Clouds tasks={tasks} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Task 2' }));
    expect(onSelect).toHaveBeenCalledWith('c2');
  });

  it('renders nothing clickable with no completed tasks', () => {
    render(<Clouds tasks={[]} onSelect={() => {}} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('defaults to static clouds and supports conveyor motion for the garden', () => {
    const { rerender } = render(<Clouds tasks={tasks} />);
    expect(screen.getByRole('list', { name: 'Recent tasks' })).toHaveAttribute('data-motion', 'static');
    rerender(<Clouds tasks={tasks} motion="conveyor" />);
    expect(screen.getByRole('list', { name: 'Recent tasks' })).toHaveAttribute('data-motion', 'conveyor');
  });

  it('renders non-interactive clouds when no onSelect is given', () => {
    render(<Clouds tasks={tasks} motion="conveyor" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('Task 0')).toBeInTheDocument();
  });
});
