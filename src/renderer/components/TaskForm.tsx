// Issue #19: "enter task" box, "category" dropdown and "start task" button.
import { notImplemented } from '../../shared/notImplemented';
import type { StartTaskInput } from '../../core/tasks';

export interface TaskFormProps {
  /** True when the pen is full. */
  disabled: boolean;
  onStart: (input: StartTaskInput) => void;
}

export function TaskForm({ disabled }: TaskFormProps) {
  return notImplemented(`TaskForm(${disabled})`);
}
