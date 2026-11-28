// Values come from docs/design-tokens.md and docs/product-spec.md.

export const COLORS = {
  darkBrown: '#4c2802',
  lightBrown: '#8c4c0c',
  beige: '#f7f3ec',
  grass: '#7ab85f',
  inputWhite: '#f3f3f3',
  sky: '#c9ecf9',
  lightGrey: '#b7b7b7',
  darkGrey: '#666666',
} as const;

/** Every plant the garden can grow, in garden plot order. */
export const PLANTS = [
  { id: 'pine', label: 'Pine' },
  { id: 'tomato', label: 'Tomato' },
  { id: 'apple', label: 'Apple' },
  { id: 'lilac', label: 'Lilac' },
  { id: 'corn', label: 'Corn' },
  { id: 'sunflower', label: 'Sunflower' },
  { id: 'carrot', label: 'Carrot' },
  { id: 'basil', label: 'Basil' },
  { id: 'succulent', label: 'Succulent' },
  { id: 'monkeygrass', label: 'Monkeygrass' },
] as const;

/**
 * The categories a fresh garden starts with. Users can rename, remove and add
 * categories and change which plant each one grows (several categories may
 * share a plant, and a category may grow none).
 */
export const DEFAULT_CATEGORIES = [
  { id: 'creative-writing', label: 'Creative writing', plant: 'basil' },
  { id: 'professional-writing', label: 'Professional writing', plant: 'lilac' },
  { id: 'leisure', label: 'Leisure', plant: 'sunflower' },
  { id: 'programming', label: 'Programming', plant: 'pine' },
  { id: 'career-development', label: 'Career development', plant: 'succulent' },
  { id: 'communication', label: 'Communication', plant: 'corn' },
  { id: 'media', label: 'Media', plant: 'tomato' },
  { id: 'geography', label: 'Geography', plant: 'apple' },
] as const;

export const MIN_CATEGORIES = 1;
export const MAX_CATEGORIES = 20;
export const MAX_CATEGORY_LABEL_LENGTH = 20;

/**
 * The fixed categories of version 1 saves, each with the plant it grew. Only
 * used to migrate those saves; they are not offered to users any more.
 */
export const LEGACY_CATEGORIES = [
  { id: 'work', label: 'Work', plant: 'pine' },
  { id: 'school', label: 'School / Study', plant: 'tomato' },
  { id: 'health', label: 'Health & Fitness', plant: 'apple' },
  { id: 'finance', label: 'Finance', plant: 'lilac' },
  { id: 'home', label: 'Home', plant: 'corn' },
  { id: 'relationships', label: 'Relationships', plant: 'sunflower' },
  { id: 'personal-growth', label: 'Personal Growth', plant: 'carrot' },
  { id: 'creative', label: 'Creative', plant: 'basil' },
  { id: 'career', label: 'Career Development', plant: 'succulent' },
  { id: 'self-care', label: 'Self-Care', plant: 'monkeygrass' },
] as const;

export const ANIMALS = [
  'cow',
  'horse',
  'pig',
  'sheep',
  'dog',
  'duck',
  'chicken',
  'donkey',
  'goat',
  'cat',
] as const;

export const MAX_ACTIVE_TASKS = 3;
export const RECENT_TASK_COUNT = 5;
/** Unlabelled clouds drifting across the Garden sky, purely decorative. */
export const GARDEN_CLOUD_COUNT = 5;

export const GROWTH_STAGES = 6;
export const MINUTES_PER_STAGE = 6;
export const MINUTES_PER_CYCLE = GROWTH_STAGES * MINUTES_PER_STAGE; // 36

/** Image scale at the very end of a stage; 1.0 at the start of a stage. */
export const MID_STAGE_MAX_SCALE = 1.15;

/**
 * Garden growth replay: productive time earned since the garden was last
 * opened plays back at this rate (one 6-minute stage = 0.36 s), capped so
 * long sessions still finish quickly, after a short pause to show the
 * starting point.
 */
export const GROWTH_ANIMATION_MS_PER_MINUTE = 60;
export const GROWTH_ANIMATION_MAX_MS = 5000;
export const GROWTH_ANIMATION_DELAY_MS = 500;

/** Plots per row in the garden before wrapping to a second row. */
export const PLOTS_PER_ROW = 5;

export const TROPHY_THRESHOLDS = {
  bronze: 1,
  silver: 10,
  gold: 100,
} as const;

export const ACTIVITYWATCH_URL = 'http://localhost:5600';

export const CLASSIFIER_MODEL = 'claude-haiku-5-5';
export const CLASSIFIER_MAX_ATTEMPTS = 3;
