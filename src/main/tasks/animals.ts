import { ANIMALS, type Animal } from '../../shared/domain'

// A random animal that isn't already in the pen.
export function pickAnimal(taken: readonly Animal[], random: () => number): Animal {
  const free = ANIMALS.filter((animal) => !taken.includes(animal))
  if (free.length === 0) throw new Error('No free animal')
  return free[Math.floor(random() * free.length)]
}
