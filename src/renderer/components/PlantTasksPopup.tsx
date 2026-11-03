// Garden plot click: a scrollable history of every completed task in that
// plant's category, newest first. Picking one opens its result popup on top.
import { useId } from 'react';
import { formatDuration } from '../../core/tasks';
import { CATEGORIES } from '../../shared/constants';
import type { CategoryId, CompletedTask } from '../../shared/types';
import { useEscape } from './useEscape';

export interface PlantTasksPopupProps {
  category: CategoryId;
  /** Already ordered newest first. */
  tasks: CompletedTask[];
  onSelectTask: (taskId: string) => void;
  onClose: () => void;
  /** False while a task's result popup is open on top of this one. */
  active?: boolean;
}

const formatDate = (epochMs: number) =>
  new Date(epochMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function PlantTasksPopup({ category, tasks, onSelectTask, onClose, active = true }: PlantTasksPopupProps) {
  const titleId = useId();
  useEscape(onClose, active);
  const plant = CATEGORIES.find((c) => c.id === category)!;

  return (
    <div className="overlay">
      <div className="popup popup--plant-tasks" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="popup__title">
          {plant.label} tasks
        </h2>
        <p className="popup__meta">
          {plant.plantLabel} · {tasks.length} completed
        </p>

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
