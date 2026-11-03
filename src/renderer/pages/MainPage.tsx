// Main page: sky with the FocusGarden window and Tasks button (top 3/4),
// recent-task clouds, and a simplified garden strip (bottom 1/4).
import { notImplemented } from '../../shared/notImplemented';
import type { Plants } from '../../core/growth';
import type { CompletedTask } from '../../shared/types';

export interface MainPageProps {
  recentTasks: CompletedTask[];
  plants: Plants;
  onOpenTasks: () => void;
  /** Cloud click: open the Task page with this task's result popup. */
  onOpenTaskResult: (taskId: string) => void;
  onOpenGarden: () => void;
}

export function MainPage({ recentTasks }: MainPageProps) {
  return notImplemented(`MainPage(${recentTasks.length})`);
}
