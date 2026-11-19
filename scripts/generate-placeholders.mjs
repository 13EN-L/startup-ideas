// Writes a transparent 1x1 PNG at every asset path the app references.
// Existing files are left alone so real artwork is never overwritten.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** 1x1 RGBA pixel with alpha 0. */
function transparentPng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); // width
  header.writeUInt32BE(1, 4); // height
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  const scanline = Buffer.from([0, 0, 0, 0, 0]); // filter byte + one RGBA pixel
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanline)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// An earlier version of this script wrote an opaque blue pixel; files that are
// exactly that pixel are placeholders too, and get replaced.
const OLD_OPAQUE_PLACEHOLDER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const PLACEHOLDER = transparentPng();

const animals = ['cow', 'horse', 'pig', 'sheep', 'dog', 'duck', 'chicken', 'donkey', 'goat', 'cat'];
const plants = ['pine', 'tomato', 'apple', 'lilac', 'corn', 'sunflower', 'carrot', 'basil', 'succulent', 'monkeygrass'];

const files = [
  'clouds/cloud.png',
  ...animals.map((a) => `animals/${a}.png`),
  ...plants.flatMap((p) => [1, 2, 3, 4, 5, 6].map((s) => `plants/${p}/stage-${s}.png`)),
  ...['bronze', 'silver', 'gold'].map((t) => `trophies/${t}.png`),
];

let created = 0;
let replaced = 0;
for (const file of files) {
  const target = join(root, file);
  if (existsSync(target)) {
    if (!readFileSync(target).equals(OLD_OPAQUE_PLACEHOLDER)) continue;
    replaced++;
  } else {
    created++;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, PLACEHOLDER);
}
console.log(
  `Placeholders: ${created} created, ${replaced} replaced, ${files.length - created - replaced} left as-is.`,
);
