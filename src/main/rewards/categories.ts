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
