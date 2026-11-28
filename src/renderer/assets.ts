// Every image points at a placeholder PNG under public/assets/; drop final art
// in at the same paths to replace it.
import { GROWTH_STAGES } from '../shared/constants';
import type { AnimalId, PlantId, Trophy } from '../shared/types';

export const CLOUD_IMAGE = 'assets/clouds/cloud.png';

export function animalImage(animal: AnimalId): string {
  return `assets/animals/${animal}.png`;
}

export function plantImage(plant: PlantId, stage: number): string {
  return `assets/plants/${plant}/stage-${stage}.png`;
}

/** The fully grown plant, used to show what a category will grow. */
export function plantPreviewImage(plant: PlantId): string {
  return plantImage(plant, GROWTH_STAGES);
}

export function trophyImage(trophy: Trophy): string {
  return `assets/trophies/${trophy}.png`;
}
