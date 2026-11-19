// Issue #19: Home sign is dark brown with 0 tasks, greyed out with 1-3
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HomeButton } from '../../../src/renderer/components/HomeButton';
import { COLORS } from '../../../src/shared/constants';
import { makeActiveTask } from '../../fixtures';

describe('#19 HomeButton', () => {
  it('is dark brown and navigates home with no active tasks', async () => {
    const onClick = vi.fn();
    render(<HomeButton activeTasks={[]} onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Home' });
    expect(button).toBeEnabled();
    expect(button).toHaveStyle({ backgroundColor: COLORS.darkBrown });
    expect(screen.getByTestId('home-post')).toHaveStyle({ backgroundColor: COLORS.lightBrown });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is greyed out and inert while a task is active', async () => {
    const onClick = vi.fn();
    render(<HomeButton activeTasks={[makeActiveTask()]} onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Home' });
    expect(button).toBeDisabled();
    expect(button).toHaveStyle({ backgroundColor: COLORS.darkGrey });
    expect(screen.getByTestId('home-post')).toHaveStyle({ backgroundColor: COLORS.lightGrey });
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
