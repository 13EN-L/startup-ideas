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

export const CATEGORIES = [
  { id: 'work', label: 'Work', plant: 'pine', plantLabel: 'Pine' },
  { id: 'school', label: 'School / Study', plant: 'tomato', plantLabel: 'Tomato' },
  { id: 'health', label: 'Health & Fitness', plant: 'apple', plantLabel: 'Apple' },
  { id: 'finance', label: 'Finance', plant: 'lilac', plantLabel: 'Lilac' },
  { id: 'home', label: 'Home', plant: 'corn', plantLabel: 'Corn' },
  { id: 'relationships', label: 'Relationships', plant: 'sunflower', plantLabel: 'Sunflower' },
  { id: 'personal-growth', label: 'Personal Growth', plant: 'carrot', plantLabel: 'Carrot' },
  { id: 'creative', label: 'Creative', plant: 'basil', plantLabel: 'Basil' },
  { id: 'career', label: 'Career Development', plant: 'succulent', plantLabel: 'Succulent' },
  { id: 'self-care', label: 'Self-Care', plant: 'monkeygrass', plantLabel: 'Monkeygrass' },
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

/** Plots per row in the garden before wrapping to a second row. */
export const PLOTS_PER_ROW = 5;

export const TROPHY_THRESHOLDS = {
  bronze: 1,
  silver: 10,
  gold: 100,
} as const;

export const ACTIVITYWATCH_URL = 'http://localhost:5600';

export const CLASSIFIER_MODEL = 'claude-opus-5-5';
export const CLASSIFIER_MAX_ATTEMPTS = 3;
