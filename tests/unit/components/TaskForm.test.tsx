// Issue #19: task input, category dropdown, start button
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defaultCategories } from '../../../src/core/categories';
import { TaskForm } from '../../../src/renderer/components/TaskForm';
import type { Category } from '../../../src/shared/types';

function setup(disabled = false, categories: Category[] = defaultCategories()) {
  const onStart = vi.fn();
  const view = render(<TaskForm categories={categories} disabled={disabled} onStart={onStart} />);
  return {
    onStart,
    rerender: (next: Category[]) => view.rerender(<TaskForm categories={next} disabled={disabled} onStart={onStart} />),
    input: screen.getByPlaceholderText('enter task'),
    select: screen.getByRole('combobox', { name: 'category' }),
    button: screen.getByRole('button', { name: 'start task' }),
  };
}

describe('#19 TaskForm', () => {
  it('renders the "enter task" box, "category" dropdown and "start task" button', () => {
    const { input, select, button } = setup();
    expect(input).toBeInTheDocument();
    expect(select).toBeInTheDocument();
    expect(button).toBeInTheDocument();
  });

  it('lists the 8 default categories after a "category" placeholder', () => {
    const { select } = setup();
    const options = Array.from((select as HTMLSelectElement).options);
    expect(options[0]).toHaveTextContent('category');
    expect(options[0]).toBeDisabled();
    expect(options.slice(1).map((o) => o.textContent)).toEqual([
      'Creative writing',
      'Professional writing',
      'Leisure',
      'Programming',
      'Career development',
      'Communication',
      'Media',
      'Geography',
    ]);
  });

  it("lists the user's own categories", () => {
    const { select } = setup(false, [
      { id: 'a', label: 'Gardening', plant: 'carrot' },
      { id: 'b', label: 'Chores', plant: null },
    ]);
    const options = Array.from((select as HTMLSelectElement).options).slice(1);
    expect(options.map((o) => [o.value, o.textContent])).toEqual([
      ['a', 'Gardening'],
      ['b', 'Chores'],
    ]);
  });

  it('starts a task with the typed name and chosen category, then clears the name', async () => {
    const user = userEvent.setup();
    const { onStart, input, select, button } = setup();
    await user.type(input, 'Study chemistry');
    await user.selectOptions(select, 'Media');
    await user.click(button);

    expect(onStart).toHaveBeenCalledWith({ name: 'Study chemistry', category: 'media' });
    expect(input).toHaveValue('');
  });

  it('says which plant the chosen category grows, or that it grows none', async () => {
    const user = userEvent.setup();
    const { select } = setup(false, [
      { id: 'a', label: 'Gardening', plant: 'carrot' },
      { id: 'b', label: 'Chores', plant: null },
    ]);
    expect(screen.queryByRole('status')).toBeNull();
    await user.selectOptions(select, 'Gardening');
    expect(screen.getByRole('status')).toHaveTextContent('Grows your Carrot');
    await user.selectOptions(select, 'Chores');
    expect(screen.getByRole('status')).toHaveTextContent("This category doesn't grow a plant");
  });

  it('keeps the button disabled until a name and category are both given', async () => {
    const user = userEvent.setup();
    const { input, select, button } = setup();
    expect(button).toBeDisabled();
    await user.type(input, '   ');
    await user.selectOptions(select, 'Programming');
    expect(button).toBeDisabled();
    await user.type(input, 'Email');
    expect(button).toBeEnabled();
  });

  it('forgets a chosen category once it no longer exists', async () => {
    const user = userEvent.setup();
    const { input, select, button, rerender } = setup();
    await user.type(input, 'Email');
    await user.selectOptions(select, 'Programming');
    rerender(defaultCategories().filter((c) => c.id !== 'programming'));
    expect(select).toHaveValue('');
    expect(button).toBeDisabled();
  });

  it('greys out "start task" when the pen is full', async () => {
    const user = userEvent.setup();
    const { onStart, input, select, button } = setup(true);
    await user.type(input, 'Fourth task');
    await user.selectOptions(select, 'Programming');
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('submits with Enter in the name box', async () => {
    const user = userEvent.setup();
    const { onStart, input, select } = setup();
    await user.selectOptions(select, 'Communication');
    await user.type(input, 'Laundry{Enter}');
    expect(onStart).toHaveBeenCalledWith({ name: 'Laundry', category: 'communication' });
  });
});
