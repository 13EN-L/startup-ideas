// Issue #19: task input, category dropdown, start button
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskForm } from '../../../src/renderer/components/TaskForm';
import { CATEGORIES } from '../../../src/shared/constants';

function setup(disabled = false) {
  const onStart = vi.fn();
  render(<TaskForm disabled={disabled} onStart={onStart} />);
  return {
    onStart,
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

  it('lists all 10 categories after a "category" placeholder', () => {
    const { select } = setup();
    const options = Array.from((select as HTMLSelectElement).options);
    expect(options[0]).toHaveTextContent('category');
    expect(options[0]).toBeDisabled();
    expect(options.slice(1).map((o) => o.textContent)).toEqual(CATEGORIES.map((c) => c.label));
  });

  it('starts a task with the typed name and chosen category, then clears the name', async () => {
    const user = userEvent.setup();
    const { onStart, input, select, button } = setup();
    await user.type(input, 'Study chemistry');
    await user.selectOptions(select, 'School / Study');
    await user.click(button);

    expect(onStart).toHaveBeenCalledWith({ name: 'Study chemistry', category: 'school' });
    expect(input).toHaveValue('');
  });

  it('keeps the button disabled until a name and category are both given', async () => {
    const user = userEvent.setup();
    const { input, select, button } = setup();
    expect(button).toBeDisabled();
    await user.type(input, '   ');
    await user.selectOptions(select, 'Work');
    expect(button).toBeDisabled();
    await user.type(input, 'Email');
    expect(button).toBeEnabled();
  });

  it('greys out "start task" when the pen is full', async () => {
    const user = userEvent.setup();
    const { onStart, input, select, button } = setup(true);
    await user.type(input, 'Fourth task');
    await user.selectOptions(select, 'Work');
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('submits with Enter in the name box', async () => {
    const user = userEvent.setup();
    const { onStart, input, select } = setup();
    await user.selectOptions(select, 'Home');
    await user.type(input, 'Laundry{Enter}');
    expect(onStart).toHaveBeenCalledWith({ name: 'Laundry', category: 'home' });
  });
});
