// Splits a 6-frame plant GIF (one frame per growth stage) into
// public/assets/plants/<plant>/stage-1.png ... stage-6.png.
//
//   npm run assets:plant -- path/to/tomato.gif tomato
//
// The garden never plays the GIF: it shows one stage image at a time and only
// animates the growth earned since the garden was last opened.
//
// Every plant is cut from the same window of the source canvas, so plants keep
// their drawn size relative to each other and stages stay aligned (the seed
// sits where the grown plant stands). Artwork outside the window is reported.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const PLANTS = ['pine', 'tomato', 'apple', 'lilac', 'corn', 'sunflower', 'carrot', 'basil', 'succulent', 'monkeygrass'];
const STAGES = 6;
/** Source canvas is 1920x1439; plants are drawn around x = 960, on ground near y = 1250. */
const CROP = { x: 640, y: 90, width: 640, height: 1170 };

function lzw(minCode, data, pixelCount) {
  const out = new Uint8Array(pixelCount);
  const clear = 1 << minCode;
  const eoi = clear + 1;
  let codeSize = minCode + 1;
  let dictPrefix = new Int32Array(4096);
  let dictSuffix = new Uint8Array(4096);
  let dictFirst = new Uint8Array(4096);
  let dictLen = new Int32Array(4096);
  for (let i = 0; i < clear; i++) { dictPrefix[i] = -1; dictSuffix[i] = i; dictFirst[i] = i; dictLen[i] = 1; }
  let next = eoi + 1;
  let prev = -1;
  let bitBuf = 0, bitCnt = 0, pos = 0, op = 0;
  const stack = new Uint8Array(4097);
  while (true) {
    while (bitCnt < codeSize) {
      if (pos >= data.length) return out;
      bitBuf |= data[pos++] << bitCnt; bitCnt += 8;
    }
    const code = bitBuf & ((1 << codeSize) - 1);
    bitBuf >>>= codeSize; bitCnt -= codeSize;
    if (code === clear) { codeSize = minCode + 1; next = eoi + 1; prev = -1; continue; }
    if (code === eoi) break;
    let c, first;
    if (code < next) { c = code; }
    else { c = prev; } // KwKwK case
    // emit string for c
    let len = dictLen[c], k = len, cc = c;
    while (cc >= 0 && k > 0) { stack[--k] = dictSuffix[cc]; cc = dictPrefix[cc]; }
    first = stack[0];
    for (let i = 0; i < len && op < pixelCount; i++) out[op++] = stack[i];
    if (code >= next) { if (op < pixelCount) out[op++] = first; }
    if (prev >= 0 && next < 4096) {
      dictPrefix[next] = prev; dictSuffix[next] = first; dictLen[next] = dictLen[prev] + 1; next++;
      if (next === (1 << codeSize) && codeSize < 12) codeSize++;
    }
    prev = code;
  }
  return out;
}

function decodeGif(path) {
  const b = readFileSync(path);
  let p = 6;
  const W = b.readUInt16LE(p), H = b.readUInt16LE(p + 2); p += 4;
  const flags = b[p]; const bg = b[p + 1]; p += 3;
  let gct = null;
  if (flags & 0x80) { const n = 2 << (flags & 7); gct = b.subarray(p, p + n * 3); p += n * 3; }
  const canvas = new Uint8Array(W * H * 4);
  const frames = [];
  let gce = { disposal: 0, delay: 0, transparent: -1 };
  while (p < b.length) {
    const t = b[p++];
    if (t === 0x3b) break;
    if (t === 0x21) {
      const label = b[p++];
      if (label === 0xf9) {
        const pf = b[p + 1];
        gce = { disposal: (pf >> 2) & 7, delay: b.readUInt16LE(p + 2) * 10, transparent: pf & 1 ? b[p + 4] : -1 };
      }
      while (b[p] !== 0) p += b[p] + 1;
      p++;
      continue;
    }
    if (t === 0x2c) {
      const x = b.readUInt16LE(p), y = b.readUInt16LE(p + 2), w = b.readUInt16LE(p + 4), h = b.readUInt16LE(p + 6);
      const f = b[p + 8]; p += 9;
      let ct = gct;
      if (f & 0x80) { const n = 2 << (f & 7); ct = b.subarray(p, p + n * 3); p += n * 3; }
      const interlaced = !!(f & 0x40);
      const minCode = b[p++];
      const chunks = [];
      while (b[p] !== 0) { chunks.push(b.subarray(p + 1, p + 1 + b[p])); p += b[p] + 1; }
      p++;
      const idx = lzw(minCode, Buffer.concat(chunks), w * h);
      const saved = gce.disposal === 3 ? canvas.slice() : null;
      const rows = [];
      if (interlaced) { for (const [s, st] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let r = s; r < h; r += st) rows.push(r); }
      else for (let r = 0; r < h; r++) rows.push(r);
      rows.forEach((row, i) => {
        for (let col = 0; col < w; col++) {
          const ci = idx[i * w + col];
          if (ci === gce.transparent) continue;
          const cx = x + col, cy = y + row;
          if (cx >= W || cy >= H) continue;
          const o = (cy * W + cx) * 4;
          canvas[o] = ct[ci * 3]; canvas[o + 1] = ct[ci * 3 + 1]; canvas[o + 2] = ct[ci * 3 + 2]; canvas[o + 3] = 255;
        }
      });
      frames.push({ rgba: canvas.slice(), delay: gce.delay });
      if (gce.disposal === 2) { for (let r = y; r < y + h; r++) canvas.fill(0, (r * W + x) * 4, (r * W + x + w) * 4); }
      else if (gce.disposal === 3) canvas.set(saved);
      gce = { disposal: 0, delay: 0, transparent: -1 };
      continue;
    }
    throw new Error(`bad block ${t} at ${p}`);
  }
  return { W, H, frames, bg, gct };
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgba) {
  const hdr = Buffer.alloc(13); hdr.writeUInt32BE(w, 0); hdr.writeUInt32BE(h, 4); hdr[8] = 8; hdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), chunk('IHDR', hdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function crop(frame, sourceWidth) {
  const out = new Uint8Array(CROP.width * CROP.height * 4);
  for (let y = 0; y < CROP.height; y++) {
    const from = ((CROP.y + y) * sourceWidth + CROP.x) * 4;
    out.set(frame.subarray(from, from + CROP.width * 4), y * CROP.width * 4);
  }
  return out;
}

/** Opaque pixels that fall outside the crop window. */
function pixelsOutsideCrop(frame, width, height) {
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= CROP.x && x < CROP.x + CROP.width && y >= CROP.y && y < CROP.y + CROP.height;
      if (!inside && frame[(y * width + x) * 4 + 3]) count++;
    }
  }
  return count;
}

const [gifPath, plant] = process.argv.slice(2);
if (!gifPath || !PLANTS.includes(plant)) {
  console.error(`Usage: npm run assets:plant -- <file.gif> <${PLANTS.join('|')}>`);
  process.exit(1);
}

const gif = decodeGif(gifPath);
if (gif.frames.length !== STAGES) {
  console.error(`${gifPath} has ${gif.frames.length} frames; expected one per stage (${STAGES}).`);
  process.exit(1);
}
if (gif.W < CROP.x + CROP.width || gif.H < CROP.y + CROP.height) {
  console.error(`${gifPath} is ${gif.W}x${gif.H}; expected the 1920x1439 plant canvas.`);
  process.exit(1);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'plants', plant);
mkdirSync(outDir, { recursive: true });
gif.frames.forEach((frame, i) => {
  const lost = pixelsOutsideCrop(frame.rgba, gif.W, gif.H);
  if (lost > 0) console.warn(`stage ${i + 1}: ${lost} pixels of artwork fall outside the crop and were cut off`);
  writeFileSync(join(outDir, `stage-${i + 1}.png`), encodePng(CROP.width, CROP.height, crop(frame.rgba, gif.W)));
});
console.log(`Wrote ${STAGES} stages to public/assets/plants/${plant}/`);
