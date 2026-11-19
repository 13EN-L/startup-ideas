// Issue #20: task result popup - breakdown bar and "What you did:" list
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskResultPopup } from '../../../src/renderer/components/TaskResultPopup';
import { makeActivity, makeCompletedTask } from '../../fixtures';

const task = makeCompletedTask({
  name: 'Write essay',
  metrics: { productiveSeconds: 1200, unproductiveSeconds: 600, idleSeconds: 200 },
  activities: [
    makeActivity({ name: 'youtube.com', seconds: 600, status: 'off-task' }),
    makeActivity({ name: 'Word', source: 'app', seconds: 1200, status: 'on-task' }),
  ],
});

describe('#20 TaskResultPopup', () => {
  it('is a dialog titled with the task name', () => {
    render(<TaskResultPopup task={task} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Write essay' });
    expect(within(dialog).getByRole('heading', { name: 'Write essay' })).toBeInTheDocument();
  });

  it('says whether each entry is an app, a website or a search', () => {
    const mixed = makeCompletedTask({
      activities: [
        makeActivity({ name: 'Word', source: 'app', seconds: 300 }),
        makeActivity({ name: 'github.com', source: 'web', seconds: 200 }),
        makeActivity({ name: 'Google search: essay tips', source: 'search', seconds: 100 }),
      ],
    });
    render(<TaskResultPopup task={mixed} onClose={() => {}} />);
    const rows = within(screen.getByRole('list', { name: 'What you did' })).getAllByRole('listitem');
    expect(rows.map((r) => r.querySelector('.activity__source')?.textContent)).toEqual(['App', 'Website', 'Search']);
  });

  it('shows the on-task / off-task / idle split as a horizontal bar', () => {
    render(<TaskResultPopup task={task} onClose={() => {}} />);
    expect(screen.getByTestId('breakdown-on-task')).toHaveStyle({ width: '60%' });
    expect(screen.getByTestId('breakdown-off-task')).toHaveStyle({ width: '30%' });
    expect(screen.getByTestId('breakdown-idle')).toHaveStyle({ width: '10%' });
    expect(screen.getByRole('img', { name: /60% on task, 30% off task, 10% idle/i })).toBeInTheDocument();
  });

  it('lists what you did with name, time and status, longest first', () => {
    render(<TaskResultPopup task={task} onClose={() => {}} />);
    expect(screen.getByText('What you did:')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'What you did' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Word');
    expect(items[0]).toHaveTextContent('20:00');
    expect(items[0]).toHaveTextContent('On task');
    expect(items[1]).toHaveTextContent('youtube.com');
    expect(items[1]).toHaveTextContent('10:00');
    expect(items[1]).toHaveTextContent('Off task');
  });

  it('makes the activity list scrollable', () => {
    render(<TaskResultPopup task={task} onClose={() => {}} />);
    expect(screen.getByRole('list', { name: 'What you did' })).toHaveStyle({ overflowY: 'auto' });
  });

  it('says so when no activity was recorded', () => {
    render(
      <TaskResultPopup
        task={makeCompletedTask({
          activities: [],
          metrics: { productiveSeconds: 0, unproductiveSeconds: 0, idleSeconds: 0 },
        })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/no activity recorded/i)).toBeInTheDocument();
  });

  it('closes via the Close button and Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TaskResultPopup task={task} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
