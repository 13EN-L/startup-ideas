// Issue #18: conveyor-belt clouds (top 1/3), grass with category plots
// (bottom 2/3), trophies and global prestige under the logo.
import { notImplemented } from '../../shared/notImplemented';
import type { Plants } from '../../core/growth';
import type { CompletedTask } from '../../shared/types';

export interface GardenPageProps {
  plants: Plants;
  recentTasks: CompletedTask[];
  onNavigateHome: () => void;
}

export function GardenPage({ plants }: GardenPageProps) {
  return notImplemented(`GardenPage(${Object.keys(plants).length})`);
}
