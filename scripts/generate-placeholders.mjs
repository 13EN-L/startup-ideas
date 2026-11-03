// Writes a transparent 1x1 PNG at every asset path the app references.
// Existing files are left alone so real artwork is never overwritten.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const animals = ['cow', 'horse', 'pig', 'sheep', 'dog', 'duck', 'chicken', 'donkey', 'goat', 'cat'];
const plants = ['pine', 'tomato', 'apple', 'lilac', 'corn', 'sunflower', 'carrot', 'basil', 'succulent', 'monkeygrass'];

const files = [
  'clouds/cloud.png',
  ...animals.map((a) => `animals/${a}.png`),
  ...plants.flatMap((p) => [1, 2, 3, 4, 5, 6].map((s) => `plants/${p}/stage-${s}.png`)),
  ...['bronze', 'silver', 'gold'].map((t) => `trophies/${t}.png`),
];

let created = 0;
for (const file of files) {
  const target = join(root, file);
  if (existsSync(target)) continue;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, TRANSPARENT_PNG);
  created++;
}
console.log(`Placeholders: ${created} created, ${files.length - created} already present.`);
