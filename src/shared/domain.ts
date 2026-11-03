// Domain types and lists shared by the main process and the renderer. Plain data only:
// nothing in src/shared/ may import Node or Electron.

export const CATEGORIES = [
  'Work',
  'School / Study',
  'Health & Fitness',
  'Finance',
  'Home',
  'Relationships',
  'Personal Growth',
  'Creative',
  'Career Development',
  'Self-Care'
] as const

export type Category = (typeof CATEGORIES)[number]

export const PLANT_FOR_CATEGORY = {
  Work: 'Pine',
  'School / Study': 'Tomato',
  'Health & Fitness': 'Apple',
  Finance: 'Lilac',
  Home: 'Corn',
  Relationships: 'Sunflower',
  'Personal Growth': 'Succulent',
  Creative: 'Basil',
  'Career Development': 'Carrot',
  'Self-Care': 'Monkey grass'
} as const satisfies Record<Category, string>

export type Plant = (typeof PLANT_FOR_CATEGORY)[Category]

// The animal pool from docs/ui-spec.md. Each active task gets a different one.
export const ANIMALS = [
  'Cow',
  'Horse',
  'Pig',
  'Sheep',
  'Dog',
  'Duck',
  'Chicken',
  'Donkey',
  'Goat',
  'Cat'
] as const

export type Animal = (typeof ANIMALS)[number]

export const MAX_ACTIVE_TASKS = 3

// A span of time in UTC epoch milliseconds, end exclusive.
export interface Interval {
  start: number
  end: number
}

export type Label = 'on-task' | 'off-task'

export type TaskStatus = 'active' | 'pending' | 'done'

// Times are UTC epoch milliseconds. stoppedAt is null while the task is active.
export interface Task {
  id: number
  name: string
  category: Category
  animal: Animal
  startedAt: number
  stoppedAt: number | null
  status: TaskStatus
}

export type Trophy = 'bronze' | 'silver' | 'gold'
