// Garden plot click: the plant's growth (focus time, stage, growth, prestige),
// a short description of the plant, then a scrollable history of every
// completed task in its category, newest first. Picking a task opens its
// result popup on top.
import { useId } from 'react';
import { getPlantGrowth } from '../../core/growth';
import { formatDuration, formatFocusTime } from '../../core/tasks';
import { CATEGORIES, GROWTH_STAGES } from '../../shared/constants';
import type { CategoryId, CompletedTask } from '../../shared/types';
import { useEscape } from './useEscape';

export interface PlantTasksPopupProps {
  category: CategoryId;
  /** The plant's accumulated productive minutes. */
  totalMinutes: number;
  /** From assets/plants/<plant>/about.txt; null when there is none, undefined while loading. */
  about?: string | null;
  /** Already ordered newest first. */
  tasks: CompletedTask[];
  onSelectTask: (taskId: string) => void;
  onClose: () => void;
  /** False while a task's result popup is open on top of this one. */
  active?: boolean;
}

const formatDate = (epochMs: number) =>
  new Date(epochMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function PlantTasksPopup({
  category,
  totalMinutes,
  about,
  tasks,
  onSelectTask,
  onClose,
  active = true,
}: PlantTasksPopupProps) {
  const titleId = useId();
  useEscape(onClose, active);
  const plant = CATEGORIES.find((c) => c.id === category)!;
  const growth = getPlantGrowth(totalMinutes);
  const growthPercent = Math.floor(growth.cycleProgress * 100);

  return (
    <div className="overlay">
      <div className="popup popup--plant-tasks" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="popup__title">
          {plant.label} tasks
        </h2>
        <p className="popup__meta">
          {plant.plantLabel} · {tasks.length} completed
        </p>

        <dl className="plant-stats" aria-label={`${plant.plantLabel} growth`}>
          <div className="plant-stats__item">
            <dt>Focus time</dt>
            <dd>{formatFocusTime(totalMinutes)}</dd>
          </div>
          <div className="plant-stats__item">
            <dt>Stage</dt>
            <dd>
              {growth.stage} of {GROWTH_STAGES}
            </dd>
          </div>
          <div className="plant-stats__item">
            <dt>Growth</dt>
            <dd>{growthPercent}%</dd>
          </div>
          <div className="plant-stats__item">
            <dt>Prestige</dt>
            <dd>{growth.prestige}</dd>
          </div>
        </dl>
        <div
          className="growth-bar"
          role="progressbar"
          aria-label="Growth this cycle"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={growthPercent}
        >
          <div className="growth-bar__fill" style={{ width: `${growthPercent}%` }} />
        </div>

        {about && <p className="plant-about">{about}</p>}

        {tasks.length > 0 ? (
          <ul className="task-history" aria-label={`${plant.label} tasks`}>
            {tasks.map((task) => (
              <li key={task.id}>
                <button type="button" className="task-history__item" onClick={() => onSelectTask(task.id)}>
                  <span className="task-history__name">{task.name}</span>
                  <span className="task-history__date">{formatDate(task.endedAt)}</span>
                  <span className="task-history__focus">{formatDuration(task.metrics.productiveSeconds)} on task</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="activity-list--empty">No completed tasks yet.</p>
        )}

        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
