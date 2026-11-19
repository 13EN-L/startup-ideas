// Plant descriptions live beside the plant's images, in
// assets/plants/<plant>/about.txt, so they are edited the same way art is swapped.
// They are read here rather than fetched by the page, because a page loaded
// from disk can't fetch local files.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CATEGORIES } from '../shared/constants';

/** Path of a category's about.txt under assetsRoot, or null for an unknown category. */
export function plantAboutPath(assetsRoot: string, category: string): string | null {
  // Only the ten known plants, so the renderer can't read arbitrary files.
  const plant = CATEGORIES.find((c) => c.id === category)?.plant;
  return plant ? path.join(assetsRoot, 'plants', plant, 'about.txt') : null;
}

/** The trimmed description, or null when the category is unknown or the file is missing or empty. */
export async function readPlantAbout(assetsRoot: string, category: string): Promise<string | null> {
  const file = plantAboutPath(assetsRoot, category);
  if (!file) return null;
  try {
    const text = (await readFile(file, 'utf8')).trim();
    return text || null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
