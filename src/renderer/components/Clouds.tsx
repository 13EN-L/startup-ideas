// Issue #20: up to 5 recent-task clouds in the static Main/Task skies. The
// Garden sky has unlabelled decorative clouds that move like a conveyor belt.
import type { CSSProperties } from 'react';
import { GARDEN_CLOUD_COUNT, RECENT_TASK_COUNT } from '../../shared/constants';
import type { CompletedTask } from '../../shared/types';
import { CLOUD_IMAGE } from '../assets';

export interface CloudsProps {
  /** Already ordered newest first; only the first 5 render. */
  tasks: CompletedTask[];
  onSelect: (taskId: string) => void;
}

export function Clouds({ tasks, onSelect }: CloudsProps) {
  return (
    <ul className="clouds clouds--static" aria-label="Recent tasks">
      {tasks.slice(0, RECENT_TASK_COUNT).map((task) => (
        <li key={task.id} className="cloud">
          <button type="button" className="cloud__body" onClick={() => onSelect(task.id)}>
            <img className="cloud__image" src={CLOUD_IMAGE} alt="" />
            <span className="cloud__label">{task.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Garden sky: clouds with no labels or clicks, hidden from screen readers. */
export function DecorativeClouds() {
  return (
    <ul className="clouds clouds--conveyor" aria-hidden="true" data-testid="decorative-clouds">
      {Array.from({ length: GARDEN_CLOUD_COUNT }, (_, index) => (
        <li key={index} className="cloud" style={{ '--cloud-index': index } as CSSProperties}>
          <div className="cloud__body">
            <img className="cloud__image" src={CLOUD_IMAGE} alt="" />
          </div>
        </li>
      ))}
    </ul>
  );
}
