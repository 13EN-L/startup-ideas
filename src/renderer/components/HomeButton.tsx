// Issue #19: dark brown sign when no tasks are active, greyed out otherwise.
import { homeButtonState } from '../../core/tasks';
import { COLORS } from '../../shared/constants';
import type { ActiveTask } from '../../shared/types';

export interface HomeButtonProps {
  activeTasks: ActiveTask[];
  onClick: () => void;
}

export function HomeButton({ activeTasks, onClick }: HomeButtonProps) {
  const { disabled, signColor, postColor } = homeButtonState(activeTasks);
  return (
    <div className="home-sign">
      <button
        type="button"
        className="home-sign__board"
        disabled={disabled}
        onClick={onClick}
        title={disabled ? 'Stop your active tasks to go home' : undefined}
        style={{ backgroundColor: signColor, color: COLORS.beige }}
      >
        Home
      </button>
      <div data-testid="home-post" className="home-sign__post" style={{ backgroundColor: postColor }} aria-hidden="true" />
    </div>
  );
}
