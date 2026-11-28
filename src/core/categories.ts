// Editable task categories: 1-20 of them, each named in at most 20 characters
// and mapped to at most one plant. Several categories may share a plant, and
// a category may grow none. Mappings only affect tasks completed afterwards.
import {
  DEFAULT_CATEGORIES,
  MAX_CATEGORIES,
  MAX_CATEGORY_LABEL_LENGTH,
  MIN_CATEGORIES,
  PLANTS,
} from '../shared/constants';
import type { Category, CategoryId, PlantId } from '../shared/types';

export class CategoryError extends Error {
  constructor(
    readonly code: 'invalid-label' | 'too-many' | 'too-few' | 'not-found' | 'unknown-plant',
    message: string,
  ) {
    super(message);
    this.name = 'CategoryError';
  }
}

export function defaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
}

/** Trims and collapses runs of whitespace, so "  Deep   work " is "Deep work". */
export function normalizeCategoryLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ');
}

export function isPlantId(value: unknown): value is PlantId {
  return PLANTS.some((p) => p.id === value);
}

export function plantLabel(plant: PlantId): string {
  return PLANTS.find((p) => p.id === plant)!.label;
}

/**
 * Why `label` can't be used as a category name, or null if it can. The
 * category being renamed (`exceptId`) doesn't clash with itself.
 */
export function categoryLabelError(label: string, categories: Category[], exceptId?: CategoryId): string | null {
  const name = normalizeCategoryLabel(label);
  if (!name) return 'Enter a category name.';
  if (name.length > MAX_CATEGORY_LABEL_LENGTH) {
    return `Category names can be at most ${MAX_CATEGORY_LABEL_LENGTH} characters.`;
  }
  const clash = categories.find((c) => c.id !== exceptId && c.label.toLowerCase() === name.toLowerCase());
  if (clash) return `You already have a category called "${clash.label}".`;
  return null;
}

export function canAddCategory(categories: Category[]): boolean {
  return categories.length < MAX_CATEGORIES;
}

export function canRemoveCategory(categories: Category[]): boolean {
  return categories.length > MIN_CATEGORIES;
}

function checkPlant(plant: PlantId | null): void {
  if (plant !== null && !isPlantId(plant)) {
    throw new CategoryError('unknown-plant', `Unknown plant: ${String(plant)}`);
  }
}

function indexOf(categories: Category[], id: CategoryId): number {
  const index = categories.findIndex((c) => c.id === id);
  if (index < 0) throw new CategoryError('not-found', `No category with id ${id}`);
  return index;
}

/** Appends a category, or inserts it at `index` (used to undo a removal). */
export function addCategory(
  categories: Category[],
  input: { id: CategoryId; label: string; plant: PlantId | null },
  index = categories.length,
): Category[] {
  if (!canAddCategory(categories)) {
    throw new CategoryError('too-many', `You can have at most ${MAX_CATEGORIES} categories.`);
  }
  const error = categoryLabelError(input.label, categories);
  if (error) throw new CategoryError('invalid-label', error);
  checkPlant(input.plant);
  if (categories.some((c) => c.id === input.id)) {
    throw new CategoryError('invalid-label', `Duplicate category id ${input.id}`);
  }
  const category: Category = { id: input.id, label: normalizeCategoryLabel(input.label), plant: input.plant };
  const at = Math.max(0, Math.min(index, categories.length));
  return [...categories.slice(0, at), category, ...categories.slice(at)];
}

export function renameCategory(categories: Category[], id: CategoryId, label: string): Category[] {
  const index = indexOf(categories, id);
  const error = categoryLabelError(label, categories, id);
  if (error) throw new CategoryError('invalid-label', error);
  return categories.map((c, i) => (i === index ? { ...c, label: normalizeCategoryLabel(label) } : c));
}

/** Only tasks completed from now on grow the new plant; existing growth stays put. */
export function setCategoryPlant(categories: Category[], id: CategoryId, plant: PlantId | null): Category[] {
  const index = indexOf(categories, id);
  checkPlant(plant);
  return categories.map((c, i) => (i === index ? { ...c, plant } : c));
}

export function removeCategory(categories: Category[], id: CategoryId): Category[] {
  indexOf(categories, id);
  if (!canRemoveCategory(categories)) {
    throw new CategoryError('too-few', `You need at least ${MIN_CATEGORIES} category.`);
  }
  return categories.filter((c) => c.id !== id);
}

/** The categories that currently grow `plant`, in list order. */
export function categoriesForPlant(categories: Category[], plant: PlantId): Category[] {
  return categories.filter((c) => c.plant === plant);
}

/** The first plant no category grows yet, or null when all are taken. */
export function firstUnusedPlant(categories: Category[]): PlantId | null {
  return PLANTS.find((p) => !categories.some((c) => c.plant === p.id))?.id ?? null;
}

/**
 * Repairs a saved category list: drops malformed entries, duplicate ids and
 * duplicate names, and keeps at most MAX_CATEGORIES. Falls back to the
 * defaults when nothing usable is left.
 */
export function sanitizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return defaultCategories();
  let categories: Category[] = [];
  for (const entry of raw) {
    if (!canAddCategory(categories)) break;
    if (!entry || typeof entry !== 'object') continue;
    const { id, label, plant } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !id || typeof label !== 'string') continue;
    if (plant !== null && !isPlantId(plant)) continue;
    try {
      categories = addCategory(categories, { id, label, plant });
    } catch {
      // Invalid or duplicate name or id: skip it.
    }
  }
  return categories.length >= MIN_CATEGORIES ? categories : defaultCategories();
}
