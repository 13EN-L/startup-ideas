// Plant descriptions live beside the plant's images, in
// assets/plants/<plant>/about.txt, so they are edited the same way art is swapped.
// They are read here rather than fetched by the page, because a page loaded
// from disk can't fetch local files.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PLANTS } from '../shared/constants';

/** Path of a plant's about.txt under assetsRoot, or null for an unknown plant. */
export function plantAboutPath(assetsRoot: string, plant: string): string | null {
  // Only the ten known plants, so the renderer can't read arbitrary files.
  const known = PLANTS.find((p) => p.id === plant)?.id;
  return known ? path.join(assetsRoot, 'plants', known, 'about.txt') : null;
}

/** The trimmed description, or null when the plant is unknown or the file is missing or empty. */
export async function readPlantAbout(assetsRoot: string, plant: string): Promise<string | null> {
  const file = plantAboutPath(assetsRoot, plant);
  if (!file) return null;
  try {
    const text = (await readFile(file, 'utf8')).trim();
    return text || null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
