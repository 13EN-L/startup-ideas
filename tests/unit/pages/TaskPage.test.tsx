// Issue #19 / #20: Task page composition
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskPage, type TaskPageProps } from '../../../src/renderer/pages/TaskPage';
import { makeActiveTask, makeCompletedTask, T0 } from '../../fixtures';

function setup(overrides: Partial<TaskPageProps> = {}) {
  const props: TaskPageProps = {
    activeTasks: [],
    recentTasks: [makeCompletedTask({ id: 'c1', name: 'Essay' })],
    now: T0,
    onStartTask: vi.fn(),
    onStopTask: vi.fn(),
    onNavigateHome: vi.fn(),
    ...overrides,
  };
  render(<TaskPage {...props} />);
  return props;
}

const three = [
  makeActiveTask({ slot: 0, name: 'A' }),
  makeActiveTask({ slot: 1, name: 'B', animal: 'pig' }),
  makeActiveTask({ slot: 2, name: 'C', animal: 'goat' }),
];

describe('#19 TaskPage', () => {
  it('shows the task form, the pen and the Home sign', () => {
    setup();
    expect(screen.getByPlaceholderText('enter task')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Animal pen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toBeEnabled();
  });

  it('passes new tasks up to the app', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.type(screen.getByPlaceholderText('enter task'), 'Budget');
    await user.selectOptions(screen.getByRole('combobox', { name: 'category' }), 'Finance');
    await user.click(screen.getByRole('button', { name: 'start task' }));
    expect(props.onStartTask).toHaveBeenCalledWith({ name: 'Budget', category: 'finance' });
  });

  it('greys out "start task" with 3 animals in the pen', () => {
    setup({ activeTasks: three });
    expect(screen.getByRole('button', { name: 'start task' })).toBeDisabled();
    expect(within(screen.getByRole('region', { name: 'Animal pen' })).getAllByRole('button')).toHaveLength(3);
  });

  it('greys out Home while any task is active', () => {
    setup({ activeTasks: three.slice(0, 1) });
    expect(screen.getByRole('button', { name: 'Home' })).toBeDisabled();
  });
});

describe('#20 TaskPage result popups', () => {
  it('opens the result popup when a cloud is clicked', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Essay' }));
    expect(screen.getByRole('dialog', { name: 'Essay' })).toBeInTheDocument();
  });

  it('opens straight into a result popup when arriving from a Main page cloud', () => {
    setup({ initialResultTaskId: 'c1' });
    expect(screen.getByRole('dialog', { name: 'Essay' })).toBeInTheDocument();
  });

  it('closes the result popup', async () => {
    setup({ initialResultTaskId: 'c1' });
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
