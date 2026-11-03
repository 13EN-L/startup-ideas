// Issue #20: vertical popup with the task title, on/off/idle breakdown bar,
// and a scrollable "What you did:" list.
import { notImplemented } from '../../shared/notImplemented';
import type { CompletedTask } from '../../shared/types';

export interface TaskResultPopupProps {
  task: CompletedTask;
  onClose: () => void;
}

export function TaskResultPopup({ task }: TaskResultPopupProps) {
  return notImplemented(`TaskResultPopup(${task.id})`);
}
