// Every image points at a placeholder PNG under public/assets/; drop final art
// in at the same paths to replace it.
import { CATEGORIES } from '../shared/constants';
import type { AnimalId, CategoryId, Trophy } from '../shared/types';

export const CLOUD_IMAGE = 'assets/clouds/cloud.png';

export function animalImage(animal: AnimalId): string {
  return `assets/animals/${animal}.png`;
}

export function plantImage(category: CategoryId, stage: number): string {
  const plant = CATEGORIES.find((c) => c.id === category)!.plant;
  return `assets/plants/${plant}/stage-${stage}.png`;
}

export function trophyImage(trophy: Trophy): string {
  return `assets/trophies/${trophy}.png`;
}
