// Issue #19: "enter task" box, "category" dropdown and "start task" button.
import { useState, type FormEvent } from 'react';
import { plantLabel } from '../../core/categories';
import type { StartTaskInput } from '../../core/tasks';
import type { Category, CategoryId } from '../../shared/types';

export interface TaskFormProps {
  /** The user's categories, in dropdown order. */
  categories: Category[];
  /** True when the pen is full. */
  disabled: boolean;
  onStart: (input: StartTaskInput) => void;
}

export function TaskForm({ categories, disabled, onStart }: TaskFormProps) {
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<CategoryId | ''>('');
  // A category removed since it was picked counts as not picked.
  const category = categories.find((c) => c.id === picked);
  const canSubmit = !disabled && name.trim().length > 0 && category !== undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onStart({ name: name.trim(), category: category.id });
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
        value={category ? category.id : ''}
        onChange={(e) => setPicked(e.target.value)}
      >
        <option value="" disabled>
          category
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      {category && (
        <p className="task-form__hint" role="status">
          {category.plant ? `Grows your ${plantLabel(category.plant)}` : "This category doesn't grow a plant"}
        </p>
      )}
      <button type="submit" className="btn" disabled={!canSubmit}>
        start task
      </button>
    </form>
  );
}
