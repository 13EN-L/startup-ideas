// Issue #20: up to 5 recent-task clouds. Main/Task skies are static; the
// Garden sky moves them like a conveyor belt.
import type { CSSProperties } from 'react';
import { RECENT_TASK_COUNT } from '../../shared/constants';
import type { CompletedTask } from '../../shared/types';
import { CLOUD_IMAGE } from '../assets';

export interface CloudsProps {
  /** Already ordered newest first; only the first 5 render. */
  tasks: CompletedTask[];
  motion?: 'static' | 'conveyor';
  /** Omit to render non-interactive clouds. */
  onSelect?: (taskId: string) => void;
}

export function Clouds({ tasks, motion = 'static', onSelect }: CloudsProps) {
  return (
    <ul className={`clouds clouds--${motion}`} aria-label="Recent tasks" data-motion={motion}>
      {tasks.slice(0, RECENT_TASK_COUNT).map((task, index) => {
        const content = (
          <>
            <img className="cloud__image" src={CLOUD_IMAGE} alt="" />
            <span className="cloud__label">{task.name}</span>
          </>
        );
        return (
          <li key={task.id} className="cloud" style={{ '--cloud-index': index } as CSSProperties}>
            {onSelect ? (
              <button type="button" className="cloud__body" onClick={() => onSelect(task.id)}>
                {content}
              </button>
            ) : (
              <div className="cloud__body">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
