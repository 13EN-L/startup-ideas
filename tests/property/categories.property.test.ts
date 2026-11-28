// Editable categories: the limits hold whatever sequence of edits is made
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addCategory,
  CategoryError,
  defaultCategories,
  removeCategory,
  renameCategory,
  sanitizeCategories,
  setCategoryPlant,
} from '../../src/core/categories';
import { MAX_CATEGORIES, MAX_CATEGORY_LABEL_LENGTH, MIN_CATEGORIES } from '../../src/shared/constants';
import type { Category } from '../../src/shared/types';
import { categoriesArb, optionalPlantArb } from './arbitraries';

type Op =
  | { type: 'add'; label: string; plant: Category['plant'] }
  | { type: 'rename'; pick: number; label: string }
  | { type: 'plant'; pick: number; plant: Category['plant'] }
  | { type: 'remove'; pick: number };

// Any typed text, including empty, too long and duplicate names.
const typedArb = fc.oneof(fc.string({ maxLength: 30 }), fc.constantFrom('Media', 'media', 'MEDIA', ' Leisure '));

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ type: fc.constant('add' as const), label: typedArb, plant: optionalPlantArb }),
  fc.record({ type: fc.constant('rename' as const), pick: fc.nat(), label: typedArb }),
  fc.record({ type: fc.constant('plant' as const), pick: fc.nat(), plant: optionalPlantArb }),
  fc.record({ type: fc.constant('remove' as const), pick: fc.nat() }),
);

function isValid(categories: Category[]) {
  expect(categories.length).toBeGreaterThanOrEqual(MIN_CATEGORIES);
  expect(categories.length).toBeLessThanOrEqual(MAX_CATEGORIES);
  for (const c of categories) {
    expect(c.label.length).toBeGreaterThan(0);
    expect(c.label.length).toBeLessThanOrEqual(MAX_CATEGORY_LABEL_LENGTH);
    expect(c.label).toBe(c.label.trim());
  }
  expect(new Set(categories.map((c) => c.label.toLowerCase())).size).toBe(categories.length);
  expect(new Set(categories.map((c) => c.id)).size).toBe(categories.length);
}

describe('category edits', () => {
  it('always keep 1-20 categories with valid, unique names; rejected edits change nothing', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 60 }), (ops) => {
        let categories = defaultCategories();
        let ids = 0;
        for (const op of ops) {
          const pick = 'pick' in op ? categories[op.pick % categories.length].id : '';
          const before = categories;
          try {
            if (op.type === 'add') categories = addCategory(categories, { id: `n${++ids}`, label: op.label, plant: op.plant });
            if (op.type === 'rename') categories = renameCategory(categories, pick, op.label);
            if (op.type === 'plant') categories = setCategoryPlant(categories, pick, op.plant);
            if (op.type === 'remove') categories = removeCategory(categories, pick);
          } catch (e) {
            expect(e).toBeInstanceOf(CategoryError);
            expect(categories).toBe(before);
          }
          isValid(categories);
        }
      }),
    );
  });

  it('repairing a saved list always gives a valid one, and leaves valid lists alone', () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        isValid(sanitizeCategories(raw));
      }),
    );
    fc.assert(
      fc.property(categoriesArb, (categories) => {
        expect(sanitizeCategories(categories)).toEqual(categories);
      }),
    );
  });
});
