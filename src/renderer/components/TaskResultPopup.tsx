// Issue #20: vertical popup with the task title, on/off/idle breakdown bar,
// and a scrollable "What you did:" list.
import { useId } from 'react';
import { breakdown } from '../../core/persistence';
import { formatDuration } from '../../core/tasks';
import type { ActivitySource, CompletedTask } from '../../shared/types';
import { useEscape } from './useEscape';

const SOURCE_LABELS: Record<ActivitySource, string> = {
  app: 'App',
  web: 'Website',
  search: 'Search',
};

export interface TaskResultPopupProps {
  task: CompletedTask;
  onClose: () => void;
}

export function TaskResultPopup({ task, onClose }: TaskResultPopupProps) {
  const titleId = useId();
  useEscape(onClose);

  const pct = breakdown(task.metrics);
  const activities = [...task.activities].sort((a, b) => b.seconds - a.seconds);

  return (
    <div className="overlay">
      <div className="popup popup--result" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="popup__title">
          {task.name}
        </h2>

        <div
          className="breakdown"
          role="img"
          aria-label={`${pct.onTask}% on task, ${pct.offTask}% off task, ${pct.idle}% idle`}
        >
          <div data-testid="breakdown-on-task" className="breakdown__segment breakdown__segment--on" style={{ width: `${pct.onTask}%` }} />
          <div data-testid="breakdown-off-task" className="breakdown__segment breakdown__segment--off" style={{ width: `${pct.offTask}%` }} />
          <div data-testid="breakdown-idle" className="breakdown__segment breakdown__segment--idle" style={{ width: `${pct.idle}%` }} />
        </div>
        <p className="breakdown__legend" aria-hidden="true">
          <span className="legend legend--on">{pct.onTask}% on task</span>
          <span className="legend legend--off">{pct.offTask}% off task</span>
          <span className="legend legend--idle">{pct.idle}% idle</span>
        </p>

        <h3 className="popup__subtitle">What you did:</h3>
        {activities.length > 0 ? (
          <ul className="activity-list" aria-label="What you did" style={{ overflowY: 'auto' }}>
            {activities.map((a) => (
              <li key={a.id} className="activity">
                <span className="activity__label">
                  <span className="activity__name" title={a.name}>
                    {a.name}
                  </span>
                  <span className="activity__source">{SOURCE_LABELS[a.source]}</span>
                </span>
                <span className="activity__time">{formatDuration(a.seconds)}</span>
                <span className={`activity__status activity__status--${a.status}`}>
                  {a.status === 'on-task' ? 'On task' : 'Off task'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="activity-list--empty">No activity recorded.</p>
        )}

        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
