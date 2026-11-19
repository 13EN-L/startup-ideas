// Issue #20: recent task clouds; the Garden's clouds are decorative only
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CLOUD_IMAGE } from '../../../src/renderer/assets';
import { Clouds, DecorativeClouds } from '../../../src/renderer/components/Clouds';
import { GARDEN_CLOUD_COUNT } from '../../../src/shared/constants';
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

  it('stays still', () => {
    render(<Clouds tasks={tasks} onSelect={() => {}} />);
    expect(screen.getByRole('list', { name: 'Recent tasks' })).toHaveClass('clouds--static');
  });
});

describe('DecorativeClouds', () => {
  it('drifts a fixed number of unlabelled, unclickable clouds', () => {
    render(<DecorativeClouds />);
    const list = screen.getByTestId('decorative-clouds');
    expect(list).toHaveClass('clouds--conveyor');
    expect(list.querySelectorAll('li')).toHaveLength(GARDEN_CLOUD_COUNT);
    expect(list).toHaveTextContent('');
    expect(list.querySelector('button')).toBeNull();
  });

  it('is hidden from screen readers', () => {
    render(<DecorativeClouds />);
    expect(screen.getByTestId('decorative-clouds')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
