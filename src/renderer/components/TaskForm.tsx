// Issue #19: "enter task" box, "category" dropdown and "start task" button.
import { useState, type FormEvent } from 'react';
import type { StartTaskInput } from '../../core/tasks';
import { CATEGORIES } from '../../shared/constants';
import type { CategoryId } from '../../shared/types';

export interface TaskFormProps {
  /** True when the pen is full. */
  disabled: boolean;
  onStart: (input: StartTaskInput) => void;
}

export function TaskForm({ disabled, onStart }: TaskFormProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CategoryId | ''>('');
  const canSubmit = !disabled && name.trim().length > 0 && category !== '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onStart({ name: name.trim(), category });
    setName('');
  };

  return (
    <form className="task-form" onSubmit={submit}>
      <input
        className="task-form__input"
        placeholder="enter task"
        aria-label="Task name"
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        className="task-form__select"
        aria-label="category"
        value={category}
        onChange={(e) => setCategory(e.target.value as CategoryId)}
      >
        <option value="" disabled>
          category
        </option>
        {CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <button type="submit" className="btn" disabled={!canSubmit}>
        start task
      </button>
    </form>
  );
}
