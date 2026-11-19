// Main page: sky with the FocusGarden window and Tasks button (top 3/4),
// recent-task clouds, and a simplified garden strip (bottom 1/4).
import { getPlantGrowth, visiblePlots, type Plants } from '../../core/growth';
import type { CompletedTask } from '../../shared/types';
import { plantImage } from '../assets';
import { Clouds } from '../components/Clouds';

export interface MainPageProps {
  recentTasks: CompletedTask[];
  plants: Plants;
  onOpenTasks: () => void;
  /** Cloud click: open the Task page with this task's result popup. */
  onOpenTaskResult: (taskId: string) => void;
  onOpenGarden: () => void;
  onOpenSettings?: () => void;
}

export function MainPage({
  recentTasks,
  plants,
  onOpenTasks,
  onOpenTaskResult,
  onOpenGarden,
  onOpenSettings,
}: MainPageProps) {
  return (
    <div className="page page--main">
      <section className="sky sky--main">
        <Clouds tasks={recentTasks} onSelect={onOpenTaskResult} />
        {onOpenSettings && (
          <button type="button" className="btn btn--secondary settings-button" onClick={onOpenSettings}>
            Settings
          </button>
        )}
        <div className="window">
          <h1 className="logo">FocusGarden</h1>
          <button type="button" className="btn btn--large" onClick={onOpenTasks}>
            Tasks
          </button>
        </div>
      </section>

      <button type="button" className="garden-strip" aria-label="Open garden" onClick={onOpenGarden}>
        {visiblePlots(plants).map((category) => (
          <span key={category} className="garden-strip__plot">
            <img src={plantImage(category, getPlantGrowth(plants[category]!.totalMinutes).stage)} alt="" />
          </span>
        ))}
      </button>
    </div>
  );
}
