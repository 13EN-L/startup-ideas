// Issue #19: dirt/straw pen with a fenced gate. Each active task's animal walks
// in the centre of its third; clicking it opens the stop popup, and Stop opens
// the gate and walks the animal out before the slot is freed.
import { notImplemented } from '../../shared/notImplemented';
import type { ActiveTask } from '../../shared/types';

export interface AnimalPenProps {
  activeTasks: ActiveTask[];
  /** Epoch ms, for the elapsed time in the stop popup. */
  now: number;
  /** Called with the Stop click time once the exit animation finishes. */
  onStopTask: (taskId: string, endedAt: number) => void;
}

export function AnimalPen({ activeTasks, now }: AnimalPenProps) {
  return notImplemented(`AnimalPen(${activeTasks.length}, ${now})`);
}
