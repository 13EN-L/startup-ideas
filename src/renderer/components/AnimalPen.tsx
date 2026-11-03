// Issue #19: dirt/straw pen with a fenced gate. Each active task's animal walks
// in the centre of its third; clicking it opens the stop popup, and Stop opens
// the gate and walks the animal out before the slot is freed.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { elapsedSeconds, formatDuration } from '../../core/tasks';
import type { ActiveTask } from '../../shared/types';
import { animalImage } from '../assets';
import { useEscape } from './useEscape';

export interface AnimalPenProps {
  activeTasks: ActiveTask[];
  /** Epoch ms, for the elapsed time in the stop popup. */
  now: number;
  /** Called with the Stop click time once the exit animation finishes. */
  onStopTask: (taskId: string, endedAt: number) => void;
}

/** Longer than the CSS exit animation; frees the slot if animationend never fires. */
const EXIT_FALLBACK_MS = 4000;

export function AnimalPen({ activeTasks, now, onStopTask }: AnimalPenProps) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  /** Task id -> time Stop was clicked, for animals walking out. */
  const [exiting, setExiting] = useState<ReadonlyMap<string, number>>(new Map());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const finishExit = useCallback(
    (taskId: string, endedAt: number) => {
      clearTimeout(timers.current.get(taskId));
      timers.current.delete(taskId);
      setExiting((current) => {
        const next = new Map(current);
        next.delete(taskId);
        return next;
      });
      onStopTask(taskId, endedAt);
    },
    [onStopTask],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const stop = (task: ActiveTask) => {
    const endedAt = now;
    setOpenTaskId(null);
    setExiting((current) => new Map(current).set(task.id, endedAt));
    timers.current.set(
      task.id,
      setTimeout(() => finishExit(task.id, endedAt), EXIT_FALLBACK_MS),
    );
  };

  const openTask = activeTasks.find((t) => t.id === openTaskId && !exiting.has(t.id));

  return (
    <section className="pen" aria-label="Animal pen">
      <div className="pen__fence" aria-hidden="true" />
      <div className="pen__gate" data-testid="pen-gate" data-open={exiting.size > 0 ? 'true' : 'false'} aria-hidden="true" />

      {activeTasks.map((task) => {
        const endedAt = exiting.get(task.id);
        return (
          <Animal
            key={task.id}
            task={task}
            leaving={endedAt !== undefined}
            onOpen={() => setOpenTaskId(task.id)}
            onExited={() => finishExit(task.id, endedAt!)}
          />
        );
      })}

      {openTask && (
        <StopTaskPopup task={openTask} now={now} onStop={() => stop(openTask)} onClose={() => setOpenTaskId(null)} />
      )}
    </section>
  );
}

interface AnimalProps {
  task: ActiveTask;
  leaving: boolean;
  onOpen: () => void;
  onExited: () => void;
}

function Animal({ task, leaving, onOpen, onExited }: AnimalProps) {
  const ref = useRef<HTMLButtonElement>(null);

  // A native listener rather than onAnimationEnd: React picks the event name by
  // feature detection and can end up listening for the webkit-prefixed one.
  useEffect(() => {
    const element = ref.current;
    if (!leaving || !element) return;
    const onAnimationEnd = (event: Event) => {
      // The sprite's own walk animation bubbles up too; only the exit counts.
      if (event.target === element) onExited();
    };
    element.addEventListener('animationend', onAnimationEnd);
    return () => element.removeEventListener('animationend', onAnimationEnd);
  }, [leaving, onExited]);

  return (
    <button
      ref={ref}
      type="button"
      className={`animal animal--slot-${task.slot}`}
      data-slot={task.slot}
      data-state={leaving ? 'exiting' : 'walking'}
      aria-label={`${task.name} (${task.animal})`}
      onClick={() => {
        if (!leaving) onOpen();
      }}
    >
      <img className="animal__sprite" src={animalImage(task.animal)} alt={task.animal} />
      <span className="animal__nametag">{task.name}</span>
    </button>
  );
}

interface StopTaskPopupProps {
  task: ActiveTask;
  now: number;
  onStop: () => void;
  onClose: () => void;
}

function StopTaskPopup({ task, now, onStop, onClose }: StopTaskPopupProps) {
  const titleId = useId();
  useEscape(onClose);
  return (
    <div className="overlay">
      <div className="popup popup--stop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="popup__title">
          {task.name}
        </h2>
        <p className="popup__elapsed" aria-label="Elapsed time">
          {formatDuration(elapsedSeconds(task, now))}
        </p>
        <div className="popup__actions">
          <button type="button" className="btn" onClick={onStop}>
            Stop
          </button>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
