import { describe, expect, it } from 'vitest'
import { ANIMALS } from '../../shared/domain'
import { pickAnimal } from './animals'

describe('pickAnimal', () => {
  it('picks from the whole pool when the pen is empty', () => {
    expect(pickAnimal([], () => 0)).toBe(ANIMALS[0])
    expect(pickAnimal([], () => 0.999)).toBe(ANIMALS[ANIMALS.length - 1])
  })

  it('never picks an animal already in the pen', () => {
    const taken = ['Cow', 'Horse'] as const
    for (let r = 0; r < 1; r += 0.05) {
      expect(taken).not.toContain(pickAnimal(taken, () => r))
    }
    expect(pickAnimal(taken, () => 0)).toBe('Pig')
  })

  it('fails when every animal is taken', () => {
    expect(() => pickAnimal(ANIMALS, () => 0)).toThrow('No free animal')
  })
})
