// Garden plot click: the plant's growth (focus time, stage, growth, prestige),
// a short description of the plant, then a scrollable history of every
// completed task that grew it, newest first. Picking a task opens its result
// popup on top.
import { useId } from 'react';
import { categoriesForPlant, plantLabel } from '../../core/categories';
import { getPlantGrowth } from '../../core/growth';
import { formatDuration, formatFocusTime, taskCategoryLabel } from '../../core/tasks';
import { GROWTH_STAGES } from '../../shared/constants';
import type { Category, CompletedTask, PlantId } from '../../shared/types';
import { useEscape } from './useEscape';

export interface PlantTasksPopupProps {
  plant: PlantId;
  /** The current category -> plant mappings. */
  categories: Category[];
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
  plant,
  categories,
  totalMinutes,
  about,
  tasks,
  onSelectTask,
  onClose,
  active = true,
}: PlantTasksPopupProps) {
  const titleId = useId();
  useEscape(onClose, active);
  const name = plantLabel(plant);
  const growing = categoriesForPlant(categories, plant);
  const growth = getPlantGrowth(totalMinutes);
  const growthPercent = Math.floor(growth.cycleProgress * 100);

  return (
    <div className="overlay">
      <div className="popup popup--plant-tasks" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="popup__title">
          {name} tasks
        </h2>
        <p className="popup__meta">
          {growing.length > 0
            ? `Grown by ${growing.map((c) => c.label).join(', ')}`
            : 'No category grows this plant right now'}{' '}
          · {tasks.length} completed
        </p>

        <dl className="plant-stats" aria-label={`${name} growth`}>
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
          <ul className="task-history" aria-label={`${name} tasks`}>
            {tasks.map((task) => (
              <li key={task.id}>
                <button type="button" className="task-history__item" onClick={() => onSelectTask(task.id)}>
                  <span className="task-history__name">{task.name}</span>
                  <span className="task-history__date">
                    {taskCategoryLabel(task, categories)} · {formatDate(task.endedAt)}
                  </span>
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
