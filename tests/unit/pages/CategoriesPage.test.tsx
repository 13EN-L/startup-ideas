// Settings -> "Modify categories and plant mappings"
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { defaultCategories } from '../../../src/core/categories';
import type { Plants } from '../../../src/core/growth';
import { plantPreviewImage } from '../../../src/renderer/assets';
import { CategoriesPage } from '../../../src/renderer/pages/CategoriesPage';
import type { Category } from '../../../src/shared/types';

function setup(initial: Category[] = defaultCategories(), plants: Plants = {}) {
  const changes: Category[][] = [];
  const onBack = vi.fn();
  let n = 0;
  function Harness() {
    const [categories, setCategories] = useState(initial);
    return (
      <CategoriesPage
        categories={categories}
        plants={plants}
        onChange={(next) => {
          changes.push(next);
          setCategories(next);
        }}
        onBack={onBack}
        createId={() => `new-${++n}`}
      />
    );
  }
  render(<Harness />);
  return { changes, onBack, latest: () => changes.at(-1) };
}

const nameInput = (index: number) => screen.getByRole('textbox', { name: `Category ${index + 1} name` });
const many = (n: number): Category[] => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, label: `Cat ${i}`, plant: null }));

describe('CategoriesPage layout', () => {
  it('lists every category with its name, plant and a count out of 20', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Categories & plants' })).toBeInTheDocument();
    expect(screen.getByLabelText('8 of 20 categories')).toHaveTextContent('8 / 20');
    expect(nameInput(0)).toHaveValue('Creative writing');
    expect(screen.getByRole('combobox', { name: 'Plant for Creative writing' })).toHaveValue('basil');
    expect(screen.getByRole('combobox', { name: 'Plant for Programming' })).toHaveValue('pine');
  });

  it('shows every plant with the categories growing it and its current growth', () => {
    setup(defaultCategories(), { pine: { plant: 'pine', totalMinutes: 36 + 13 } });
    const pine = within(screen.getByTestId('plant-card-pine'));
    expect(pine.getByText('Programming')).toBeInTheDocument();
    expect(pine.getByText('Stage 3 of 6 · Prestige 1')).toBeInTheDocument();
    expect(within(screen.getByTestId('plant-card-tomato')).getByText('Not planted yet')).toBeInTheDocument();
    expect(within(screen.getByTestId('plant-card-carrot')).getByText('No categories')).toBeInTheDocument();
  });

  it('explains that changes only affect future tasks', () => {
    setup();
    expect(screen.getByText(/Changes apply to tasks you finish from now on/)).toBeInTheDocument();
  });

  it('goes back to Settings', async () => {
    const { onBack } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Back to settings/ }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('CategoriesPage renaming', () => {
  it('saves a valid new name with Enter, keeping the id and plant', async () => {
    const user = userEvent.setup();
    const { changes, latest } = setup();
    await user.clear(nameInput(6));
    await user.type(nameInput(6), 'Deep  work ');
    expect(changes).toEqual([]); // nothing saved while typing
    await user.keyboard('{Enter}');
    expect(changes).toHaveLength(1);
    expect(latest()?.find((c) => c.id === 'media')).toEqual({ id: 'media', label: 'Deep work', plant: 'tomato' });
    expect(nameInput(6)).toHaveValue('Deep work');
    expect(screen.getByRole('combobox', { name: 'Plant for Deep work' })).toBeInTheDocument();
  });

  it('saves a rename when leaving the box', async () => {
    const user = userEvent.setup();
    const { latest } = setup();
    await user.clear(nameInput(6));
    await user.type(nameInput(6), 'Videos');
    await user.tab();
    expect(latest()?.find((c) => c.id === 'media')?.label).toBe('Videos');
  });

  it('limits names to 20 characters and shows the count', async () => {
    const user = userEvent.setup();
    setup();
    expect(within(screen.getByTestId('category-row-0')).getByText('16/20')).toBeInTheDocument(); // "Creative writing"
    await user.clear(nameInput(0));
    await user.type(nameInput(0), 'A very long category name indeed');
    expect(nameInput(0)).toHaveAttribute('maxLength', '20');
    expect((nameInput(0) as HTMLInputElement).value).toHaveLength(20);
    expect(within(screen.getByTestId('category-row-0')).getByText('20/20')).toBeInTheDocument();
  });

  it('explains a duplicate or empty name, saves nothing, and restores the name on leaving', async () => {
    const user = userEvent.setup();
    const { changes } = setup();
    await user.clear(nameInput(6));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a category name.');
    await user.type(nameInput(6), 'leisure');
    expect(screen.getByRole('alert')).toHaveTextContent('You already have a category called "Leisure".');
    expect(nameInput(6)).toHaveAttribute('aria-invalid', 'true');

    await user.tab();
    expect(changes).toEqual([]);
    expect(nameInput(6)).toHaveValue('Media');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cancels a rename with Escape', async () => {
    const user = userEvent.setup();
    const { changes } = setup();
    await user.clear(nameInput(6));
    await user.type(nameInput(6), 'Videos{Escape}');
    expect(changes).toEqual([]);
    expect(nameInput(6)).toHaveValue('Media');
  });
});

describe('CategoriesPage plant mapping', () => {
  it('moves a category to another plant, which may be shared, or to none', async () => {
    const user = userEvent.setup();
    const { latest } = setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Plant for Media' }), 'Pine');
    expect(latest()?.find((c) => c.id === 'media')?.plant).toBe('pine');
    expect(within(screen.getByTestId('plant-card-pine')).getByText('Media')).toBeInTheDocument();
    expect(within(screen.getByTestId('plant-card-tomato')).getByText('No categories')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Plant for Media' }), 'No plant');
    expect(latest()?.find((c) => c.id === 'media')?.plant).toBeNull();
  });

  it('shows the plant in a little plot beside each category', () => {
    setup([{ id: 'a', label: 'A', plant: 'lilac' }]);
    const row = screen.getByTestId('category-row-0');
    expect(row.querySelector('img')).toHaveAttribute('src', plantPreviewImage('lilac'));
  });
});

describe('CategoriesPage adding and removing', () => {
  it('adds a category with the plant chosen, suggesting one no category grows yet', async () => {
    const user = userEvent.setup();
    const { latest } = setup();
    const plant = screen.getByRole('combobox', { name: 'Plant for the new category' });
    expect(plant).toHaveValue('carrot');
    await user.type(screen.getByLabelText('Add a category'), 'Gardening{Enter}');
    expect(latest()?.at(-1)).toEqual({ id: 'new-1', label: 'Gardening', plant: 'carrot' });
    expect(screen.getByLabelText('Add a category')).toHaveValue('');
    expect(plant).toHaveValue('monkeygrass');
    expect(screen.getByLabelText('9 of 20 categories')).toBeInTheDocument();
  });

  it("won't add an empty or duplicate name", async () => {
    const user = userEvent.setup();
    setup();
    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();
    await user.type(screen.getByLabelText('Add a category'), 'MEDIA');
    expect(add).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('You already have a category called "Media".');
  });

  it('stops at 20 categories', () => {
    setup(many(20));
    expect(screen.queryByLabelText('Add a category')).not.toBeInTheDocument();
    expect(screen.getByText(/You have 20 categories, the most allowed/)).toBeInTheDocument();
  });

  it('removes a category and can undo it', async () => {
    const user = userEvent.setup();
    const { latest } = setup();
    await user.click(screen.getByRole('button', { name: 'Remove Media' }));
    expect(latest()?.map((c) => c.id)).not.toContain('media');
    expect(screen.getByRole('status')).toHaveTextContent('Removed "Media".');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(latest()?.map((c) => c.id)).toEqual(defaultCategories().map((c) => c.id));
  });

  it('never removes the last category', () => {
    setup(many(1));
    expect(screen.getByRole('button', { name: 'Remove Cat 0' })).toBeDisabled();
  });
});
