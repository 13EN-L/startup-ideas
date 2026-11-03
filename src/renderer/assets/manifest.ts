// The one place art is loaded from. Every image is a PNG in this folder; until real art exists
// each is a blank placeholder, so updating art only means replacing the file.
import type { Animal, Plant, Trophy } from '../../shared/domain'

type Files = Record<string, string>

const plants: Files = import.meta.glob('./plants/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})
const animals: Files = import.meta.glob('./animals/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})
const uiFiles: Files = import.meta.glob('./ui/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})

function required(files: Files, path: string, what: string): string {
  const url = files[path]
  if (!url) throw new Error(`No image for ${what}`)
  return url
}

// "Monkey grass" → "monkeygrass"
const fileName = (name: string): string => name.toLowerCase().replace(/\s+/g, '')

export function plantImage(plant: Plant, stage: number): string {
  return required(
    plants,
    `./plants/${fileName(plant)}-stage${stage}.png`,
    `${plant} stage ${stage}`
  )
}

export function animalImage(animal: Animal): string {
  return required(animals, `./animals/${fileName(animal)}.png`, animal)
}

export function trophyImage(trophy: Trophy): string {
  return required(uiFiles, `./ui/trophy-${trophy}.png`, `${trophy} trophy`)
}

const uiImage = (name: string): string => required(uiFiles, `./ui/${name}.png`, name)

export const ui = {
  cloud: uiImage('cloud'),
  fence: uiImage('fence'),
  gate: uiImage('gate'),
  logo: uiImage('logo'),
  spinner: uiImage('spinner'),
  homeSign: { active: uiImage('home-sign-active'), inactive: uiImage('home-sign-inactive') }
}
