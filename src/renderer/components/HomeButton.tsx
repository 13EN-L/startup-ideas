// Issue #19: dark brown sign when no tasks are active, greyed out otherwise.
import { notImplemented } from '../../shared/notImplemented';
import type { ActiveTask } from '../../shared/types';

export interface HomeButtonProps {
  activeTasks: ActiveTask[];
  onClick: () => void;
}

export function HomeButton({ activeTasks }: HomeButtonProps) {
  return notImplemented(`HomeButton(${activeTasks.length})`);
}
