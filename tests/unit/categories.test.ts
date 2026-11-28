// Editable categories: 1-20 of them, names up to 20 characters, at most one plant each
import { describe, expect, it } from 'vitest';
import {
  addCategory,
  canAddCategory,
  canRemoveCategory,
  categoriesForPlant,
  categoryLabelError,
  defaultCategories,
  firstUnusedPlant,
  normalizeCategoryLabel,
  removeCategory,
  renameCategory,
  sanitizeCategories,
  setCategoryPlant,
} from '../../src/core/categories';
import { MAX_CATEGORIES, PLANTS } from '../../src/shared/constants';
import type { Category, PlantId } from '../../src/shared/types';

const many = (n: number): Category[] => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, label: `Cat ${i}`, plant: null }));

describe('defaultCategories', () => {
  it('is the 8 requested categories, each with its own plant', () => {
    const categories = defaultCategories();
    expect(categories.map((c) => c.label)).toEqual([
      'Creative writing',
      'Professional writing',
      'Leisure',
      'Programming',
      'Career development',
      'Communication',
      'Media',
      'Geography',
    ]);
    expect(new Set(categories.map((c) => c.plant)).size).toBe(8);
  });

  it('returns a fresh copy each time', () => {
    const a = defaultCategories();
    a[0].label = 'Changed';
    expect(defaultCategories()[0].label).toBe('Creative writing');
  });
});

describe('category names', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeCategoryLabel('  Deep   work ')).toBe('Deep work');
  });

  it.each([
    ['', 'Enter a category name.'],
    ['   ', 'Enter a category name.'],
    ['x'.repeat(21), 'Category names can be at most 20 characters.'],
  ])('rejects %j', (label, message) => {
    expect(categoryLabelError(label, defaultCategories())).toBe(message);
  });

  it('allows exactly 20 characters, counted after trimming', () => {
    expect(categoryLabelError('x'.repeat(20), [])).toBeNull();
    expect(categoryLabelError(`  ${'x'.repeat(20)}  `, [])).toBeNull();
  });

  it('rejects a name another category already has, ignoring case', () => {
    expect(categoryLabelError('programming', defaultCategories())).toBe('You already have a category called "Programming".');
  });

  it("doesn't clash with the category being renamed", () => {
    expect(categoryLabelError('PROGRAMMING', defaultCategories(), 'programming')).toBeNull();
  });
});

describe('addCategory', () => {
  it('appends a category with a normalized name', () => {
    const next = addCategory(defaultCategories(), { id: 'n', label: ' Gardening ', plant: 'carrot' });
    expect(next).toHaveLength(9);
    expect(next.at(-1)).toEqual({ id: 'n', label: 'Gardening', plant: 'carrot' });
  });

  it('can insert at a position (to undo a removal)', () => {
    const next = addCategory(many(3), { id: 'n', label: 'New', plant: null }, 1);
    expect(next.map((c) => c.id)).toEqual(['c0', 'n', 'c1', 'c2']);
  });

  it('allows a plant another category already grows, or none', () => {
    const next = addCategory(defaultCategories(), { id: 'n', label: 'Coding', plant: 'pine' });
    expect(categoriesForPlant(next, 'pine').map((c) => c.label)).toEqual(['Programming', 'Coding']);
    expect(addCategory(next, { id: 'm', label: 'None', plant: null }).at(-1)?.plant).toBeNull();
  });

  it(`refuses a ${MAX_CATEGORIES + 1}st category`, () => {
    expect(canAddCategory(many(MAX_CATEGORIES - 1))).toBe(true);
    expect(canAddCategory(many(MAX_CATEGORIES))).toBe(false);
    expect(() => addCategory(many(MAX_CATEGORIES), { id: 'n', label: 'One more', plant: null })).toThrow(
      expect.objectContaining({ code: 'too-many' }),
    );
  });

  it('refuses invalid names, unknown plants and duplicate ids', () => {
    expect(() => addCategory([], { id: 'n', label: '', plant: null })).toThrow(expect.objectContaining({ code: 'invalid-label' }));
    expect(() => addCategory([], { id: 'n', label: 'A', plant: 'banana' as PlantId })).toThrow(
      expect.objectContaining({ code: 'unknown-plant' }),
    );
    expect(() => addCategory(many(1), { id: 'c0', label: 'Other', plant: null })).toThrow();
  });
});

describe('renameCategory', () => {
  it('changes only the name, keeping the id and plant', () => {
    const next = renameCategory(defaultCategories(), 'media', 'Videos');
    expect(next.find((c) => c.id === 'media')).toEqual({ id: 'media', label: 'Videos', plant: 'tomato' });
    expect(next).toHaveLength(8);
  });

  it('refuses a clash or an empty name, and an unknown id', () => {
    expect(() => renameCategory(defaultCategories(), 'media', 'leisure')).toThrow(expect.objectContaining({ code: 'invalid-label' }));
    expect(() => renameCategory(defaultCategories(), 'media', ' ')).toThrow(expect.objectContaining({ code: 'invalid-label' }));
    expect(() => renameCategory(defaultCategories(), 'nope', 'X')).toThrow(expect.objectContaining({ code: 'not-found' }));
  });
});

describe('setCategoryPlant', () => {
  it('maps a category to another plant or to none', () => {
    const moved = setCategoryPlant(defaultCategories(), 'media', 'carrot');
    expect(moved.find((c) => c.id === 'media')?.plant).toBe('carrot');
    expect(setCategoryPlant(moved, 'media', null).find((c) => c.id === 'media')?.plant).toBeNull();
  });

  it('refuses an unknown plant', () => {
    expect(() => setCategoryPlant(defaultCategories(), 'media', 'banana' as PlantId)).toThrow(
      expect.objectContaining({ code: 'unknown-plant' }),
    );
  });
});

describe('removeCategory', () => {
  it('removes the category', () => {
    expect(removeCategory(defaultCategories(), 'media').map((c) => c.id)).not.toContain('media');
  });

  it('never removes the last category', () => {
    expect(canRemoveCategory(many(2))).toBe(true);
    expect(canRemoveCategory(many(1))).toBe(false);
    expect(() => removeCategory(many(1), 'c0')).toThrow(expect.objectContaining({ code: 'too-few' }));
  });
});

describe('firstUnusedPlant', () => {
  it('suggests the first plant no category grows', () => {
    expect(firstUnusedPlant(defaultCategories())).toBe('carrot');
    expect(firstUnusedPlant([])).toBe(PLANTS[0].id);
  });

  it('is null when every plant is taken', () => {
    expect(firstUnusedPlant(PLANTS.map((p) => ({ id: p.id, label: p.label, plant: p.id })))).toBeNull();
  });
});

describe('sanitizeCategories', () => {
  it('keeps a valid list as it is', () => {
    expect(sanitizeCategories(defaultCategories())).toEqual(defaultCategories());
  });

  it('falls back to the defaults for nothing usable', () => {
    expect(sanitizeCategories(undefined)).toEqual(defaultCategories());
    expect(sanitizeCategories([{ id: 1, label: 'x' }])).toEqual(defaultCategories());
  });
});
