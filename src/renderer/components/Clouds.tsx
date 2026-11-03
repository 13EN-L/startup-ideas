// Issue #20: up to 5 recent-task clouds. Main/Task skies are static; the
// Garden sky moves them like a conveyor belt.
import { notImplemented } from '../../shared/notImplemented';
import type { CompletedTask } from '../../shared/types';

export interface CloudsProps {
  /** Already ordered newest first; only the first 5 render. */
  tasks: CompletedTask[];
  motion?: 'static' | 'conveyor';
  /** Omit to render non-interactive clouds. */
  onSelect?: (taskId: string) => void;
}

export function Clouds({ tasks, motion = 'static' }: CloudsProps) {
  return notImplemented(`Clouds(${tasks.length}, ${motion})`);
}
