// Plant descriptions: assets/plants/<plant>/about.txt, read by the main process
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { plantAboutPath, readPlantAbout } from '../../src/main/plantAbout';
import { CATEGORIES } from '../../src/shared/constants';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'focusgarden-assets-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('readPlantAbout', () => {
  it("reads the category's plant file, trimmed", async () => {
    await mkdir(path.join(root, 'plants', 'pine'), { recursive: true });
    await writeFile(path.join(root, 'plants', 'pine', 'about.txt'), '\n  Pines are evergreen.  \n');
    await expect(readPlantAbout(root, 'work')).resolves.toBe('Pines are evergreen.');
  });

  it('returns null for a missing or empty file', async () => {
    await expect(readPlantAbout(root, 'work')).resolves.toBeNull();
    await mkdir(path.join(root, 'plants', 'tomato'), { recursive: true });
    await writeFile(path.join(root, 'plants', 'tomato', 'about.txt'), '   ');
    await expect(readPlantAbout(root, 'school')).resolves.toBeNull();
  });

  it('only reads the ten known plants, never arbitrary paths', async () => {
    expect(plantAboutPath(root, '../../secrets')).toBeNull();
    expect(plantAboutPath(root, 'pine')).toBeNull(); // a plant name, not a category id
    await expect(readPlantAbout(root, '../settings')).resolves.toBeNull();
  });
});

describe('shipped plant descriptions', () => {
  it.each(CATEGORIES.map((c) => [c.plantLabel, c.id] as const))('%s has a description', async (_label, id) => {
    const about = await readPlantAbout(path.resolve(__dirname, '../../public/assets'), id);
    expect(about).toBeTruthy();
    expect(about!.length).toBeLessThan(300);
  });
});
