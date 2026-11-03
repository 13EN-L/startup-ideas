import { describe, expect, it } from 'vitest'
import { CATEGORIES, PLANT_FOR_CATEGORY } from './categories'

describe('categories', () => {
  it('lists the 10 categories in docs/rewards.md order', () => {
    expect(CATEGORIES).toEqual([
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
    ])
  })

  it('maps each category to its plant', () => {
    expect(PLANT_FOR_CATEGORY).toEqual({
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
    })
  })
})
