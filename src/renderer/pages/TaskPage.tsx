// Issue #19/#20: sky window with the task form (top 2/3), recent-task clouds,
// animal pen (bottom 1/3) and the Home sign.
import { notImplemented } from '../../shared/notImplemented';
import type { StartTaskInput } from '../../core/tasks';
import type { ActiveTask, CompletedTask } from '../../shared/types';

export interface TaskPageProps {
  activeTasks: ActiveTask[];
  recentTasks: CompletedTask[];
  now: number;
  /** Result popup to show on arrival (set when a Main page cloud was clicked). */
  initialResultTaskId?: string;
  onStartTask: (input: StartTaskInput) => void;
  onStopTask: (taskId: string, endedAt: number) => void;
  onNavigateHome: () => void;
}

export function TaskPage({ activeTasks }: TaskPageProps) {
  return notImplemented(`TaskPage(${activeTasks.length})`);
}
