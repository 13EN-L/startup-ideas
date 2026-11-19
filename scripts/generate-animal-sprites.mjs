// Draws the pen animals as pixel art and writes public/assets/animals/<animal>.png.
//
//   npm run assets:animals
//
// Every animal is drawn on the same 40x32 grid (facing right, feet on the
// bottom row), so sizes stay comparable: the chicken is smaller than the horse.
// Each art pixel becomes a SCALE x SCALE block, like the chunky plant art.
// Edit an animal's shapes or palette below and re-run to change it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const W = 40;
const H = 32;
const SCALE = 10;

class Sprite {
  constructor() {
    this.px = Array.from({ length: H }, () => Array(W).fill(null));
  }
  set(x, y, c) {
    if (x >= 0 && x < W && y >= 0 && y < H) this.px[y][x] = c;
  }
  get(x, y) {
    return x >= 0 && x < W && y >= 0 && y < H ? this.px[y][x] : null;
  }
  /** Filled rectangle, corners inclusive. */
  rect(x0, y0, x1, y1, c) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c);
    return this;
  }
  /** Filled ellipse centred on (cx, cy); half-pixel centres are fine. */
  oval(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.35);
        const dy = (y - cy) / (ry + 0.35);
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
    return this;
  }
  dots(points, c) {
    for (const [x, y] of points) this.set(x, y, c);
    return this;
  }
  /** Recolours already-drawn pixels inside a shape (for spots and shading). */
  paint(shape, c) {
    const mask = new Sprite();
    shape(mask);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask.px[y][x] && this.px[y][x]) this.px[y][x] = c;
    return this;
  }
  /** One-pixel outline around everything drawn so far. */
  outline(c) {
    const edge = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.px[y][x]) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) edge.push([x, y]);
      }
    }
    return this.dots(edge, c);
  }
}

/** Shared four-legged body: far legs in shade behind, near legs in front. */
function legs(s, xs, top, bottom, near, far, hoof) {
  xs.forEach((x, i) => {
    const colour = i % 2 === 0 ? far : near;
    s.rect(x, top, x + 1, bottom - 1, colour).rect(x, bottom, x + 1, bottom, hoof);
  });
}

const animals = {
  cow() {
    const c = { white: '#f4f1ea', shade: '#d6cfc0', black: '#34302b', pink: '#eba5a3', hoof: '#5b4a3a', horn: '#eadcb0', line: '#3a332c' };
    const s = new Sprite();
    legs(s, [8, 11, 23, 26], 20, 30, c.white, c.shade, c.hoof);
    s.oval(17.5, 16, 12, 6, c.white);
    s.oval(16, 22, 2.5, 1.5, c.pink); // udder
    s.rect(4, 13, 5, 14, c.white).rect(3, 15, 3, 21, c.white).rect(2, 21, 4, 23, c.black); // tail
    s.rect(27, 10, 31, 17, c.white); // neck
    s.oval(33, 11.5, 3.5, 3.5, c.white); // head
    s.rect(34, 13, 37, 16, c.pink).dots([[36, 14]], '#b9706e'); // muzzle
    s.dots([[29, 9], [29, 8], [36, 9], [36, 8]], c.horn);
    s.rect(28, 10, 29, 11, c.black); // ear
    s.paint((m) => m.oval(13, 14, 4, 3, 1).oval(22, 18, 3, 2.5, 1).oval(29.5, 11, 1.5, 1.5, 1).oval(9, 18, 2, 2, 1), c.black);
    s.dots([[33, 11]], '#111');
    s.paint((m) => m.rect(6, 20, 29, 21, 1), c.shade);
    return s.outline(c.line);
  },

  horse() {
    const c = { coat: '#b0682f', shade: '#8a4d20', mane: '#4a2a14', hoof: '#2f2219', blaze: '#f1e6d2', line: '#3d2210' };
    const s = new Sprite();
    legs(s, [8, 11, 24, 27], 19, 30, c.coat, c.shade, c.hoof);
    s.rect(24, 26, 28, 28, c.blaze).rect(24, 26, 25, 28, c.shade); // white sock, far side shaded
    s.oval(18, 15, 11.5, 5, c.coat);
    s.rect(26, 7, 30, 15, c.coat).rect(27, 5, 31, 8, c.coat); // neck
    s.rect(29, 4, 35, 9, c.coat).rect(33, 7, 37, 11, c.coat); // head and long muzzle
    s.rect(34, 6, 35, 9, c.blaze); // blaze
    s.dots([[29, 3], [30, 2], [31, 3]], c.coat); // ear
    s.rect(25, 4, 27, 13, c.mane).dots([[28, 3], [28, 4], [24, 9], [24, 10], [24, 12]], c.mane); // mane
    s.rect(5, 12, 7, 14, c.mane).rect(4, 14, 5, 22, c.mane).dots([[3, 20], [3, 21], [6, 22]], c.mane); // tail
    s.dots([[31, 6]], '#111').dots([[36, 10]], c.mane);
    s.paint((m) => m.rect(8, 18, 29, 19, 1), c.shade);
    return s.outline(c.line);
  },

  pig() {
    const c = { pink: '#f2b3b0', shade: '#d98f90', snout: '#e88b8f', nostril: '#9c4f55', hoof: '#8a5a55', line: '#8a474c' };
    const s = new Sprite();
    legs(s, [9, 12, 24, 27], 25, 30, c.pink, c.shade, c.hoof);
    s.oval(19, 20, 12, 6, c.pink);
    s.oval(31, 18.5, 4.5, 4.5, c.pink); // head
    s.rect(35, 17, 37, 21, c.snout).dots([[37, 18], [37, 20]], c.nostril);
    s.dots([[30, 13], [31, 13], [30, 14], [31, 14], [32, 14], [29, 14]], c.shade); // ear
    s.dots([[32, 17]], '#2b1c1c');
    s.dots([[7, 16], [6, 15], [5, 16], [5, 17], [6, 18]], c.pink); // curly tail
    s.paint((m) => m.rect(8, 24, 30, 26, 1), c.shade);
    return s.outline(c.line);
  },

  sheep() {
    const c = { wool: '#f3efe3', woolShade: '#d7cfbc', face: '#3d3531', hoof: '#2a2420', line: '#9b917c' };
    const s = new Sprite();
    legs(s, [10, 13, 23, 26], 23, 30, c.face, '#2a2420', c.hoof);
    // Lumpy fleece.
    s.oval(18, 18, 11, 6, c.wool);
    for (const [x, y] of [[9, 14], [14, 12], [20, 12], [25, 14], [8, 20], [28, 19], [13, 23], [19, 24], [24, 23]]) s.oval(x, y, 2.5, 2.5, c.wool);
    s.paint((m) => m.rect(6, 22, 30, 26, 1), c.woolShade);
    s.dots([[12, 17], [17, 15], [22, 18], [16, 20], [26, 16]], c.woolShade);
    s.oval(32, 16, 3, 3.5, c.face).rect(33, 17, 35, 19, c.face); // head
    s.oval(30, 12.5, 2.5, 1.5, c.wool); // topknot
    s.rect(28, 15, 29, 16, c.face); // ear
    s.dots([[33, 15]], '#f3efe3');
    return s.outline(c.line);
  },

  dog() {
    const c = { coat: '#dba35a', shade: '#b47e3a', ear: '#8a5a26', chest: '#f1dcb4', nose: '#2e2622', line: '#5a3714' };
    const s = new Sprite();
    legs(s, [11, 14, 24, 27], 23, 30, c.coat, c.shade, c.shade);
    s.oval(19.5, 19, 9.5, 4.5, c.coat);
    s.rect(26, 13, 30, 21, c.coat); // neck
    s.oval(30, 12, 4, 3.5, c.coat); // head
    s.rect(32, 12, 36, 15, c.coat).dots([[37, 12], [37, 13]], c.nose); // muzzle
    s.rect(27, 10, 28, 15, c.ear).dots([[29, 9]], c.ear); // floppy ear
    s.rect(28, 17, 31, 21, c.chest);
    s.dots([[31, 11]], '#111').dots([[33, 15], [34, 16]], '#c96a6a'); // eye, tongue
    s.dots([[9, 17], [8, 16], [7, 15], [6, 14], [6, 13], [7, 14]], c.coat); // tail up
    s.paint((m) => m.rect(10, 22, 29, 23, 1), c.shade);
    return s.outline(c.line);
  },

  duck() {
    const c = { body: '#b9b4a6', shade: '#8f8a7e', chest: '#8a5a3a', head: '#3f7a4a', collar: '#f4f1ea', bill: '#e8c440', feet: '#ec9a35', wing: '#5a6f9e', line: '#3a3530' };
    const s = new Sprite();
    s.rect(18, 27, 19, 29, c.feet).rect(17, 30, 20, 30, c.feet).rect(22, 27, 23, 29, c.feet).rect(21, 30, 24, 30, c.feet);
    s.oval(20, 23, 8, 4.5, c.body);
    s.dots([[11, 20], [12, 20], [11, 21], [10, 19]], c.body); // tail flick
    s.oval(26, 22, 3.5, 3.5, c.chest);
    s.rect(25, 15, 28, 19, c.head);
    s.oval(27, 14, 3, 3, c.head); // head
    s.rect(25, 19, 28, 19, c.collar);
    s.rect(30, 14, 33, 15, c.bill).rect(30, 16, 32, 16, c.bill);
    s.dots([[28, 13]], '#111');
    s.paint((m) => m.oval(18, 22, 5, 2.5, 1), c.shade).dots([[15, 22], [16, 22], [17, 22]], c.wing);
    return s.outline(c.line);
  },

  chicken() {
    const c = { feather: '#b85b2c', shade: '#8e3f1c', tail: '#5a2a14', comb: '#d63a2a', beak: '#f0b43a', legs: '#e8b040', line: '#4f2410' };
    const s = new Sprite();
    s.rect(19, 26, 19, 29, c.legs).rect(18, 30, 21, 30, c.legs).rect(22, 26, 22, 29, c.legs).rect(21, 30, 24, 30, c.legs);
    s.oval(20, 22, 6.5, 4.5, c.feather);
    s.oval(13, 17, 2.5, 3.5, c.tail).dots([[12, 13], [13, 13], [11, 14]], c.tail); // tail feathers
    s.oval(26, 15, 3, 3.5, c.feather); // head and neck
    s.rect(25, 17, 27, 19, c.feather);
    s.dots([[25, 11], [26, 10], [27, 11], [28, 10], [26, 11], [27, 12]], c.comb);
    s.rect(29, 15, 30, 15, c.beak).dots([[29, 16]], c.beak);
    s.dots([[28, 17], [28, 18]], c.comb); // wattle
    s.dots([[27, 14]], '#111');
    s.paint((m) => m.oval(19, 22, 4, 2.5, 1), c.shade);
    return s.outline(c.line);
  },

  donkey() {
    const c = { coat: '#9c938b', shade: '#7a716a', light: '#ddd5c8', mane: '#4a433e', hoof: '#2e2925', line: '#3e3833' };
    const s = new Sprite();
    legs(s, [9, 12, 24, 27], 21, 30, c.coat, c.shade, c.hoof);
    s.oval(18.5, 17, 11, 5, c.coat);
    s.paint((m) => m.rect(8, 20, 30, 22, 1), c.light); // pale belly
    s.rect(26, 10, 30, 17, c.coat); // neck
    s.rect(28, 8, 34, 13, c.coat).rect(32, 11, 36, 14, c.coat); // head
    s.rect(33, 12, 36, 14, c.light).dots([[36, 13]], c.mane); // pale muzzle
    s.rect(28, 2, 29, 7, c.coat).rect(31, 3, 32, 7, c.shade).dots([[28, 4], [28, 5]], c.light); // long ears
    s.rect(25, 7, 26, 15, c.mane).dots([[27, 6]], c.mane);
    s.rect(6, 14, 7, 21, c.coat).rect(5, 21, 7, 23, c.mane); // tail with tuft
    s.dots([[31, 9]], '#111');
    return s.outline(c.line);
  },

  goat() {
    const c = { coat: '#ece5d4', shade: '#cbbfa6', patch: '#8a6a44', horn: '#8c8070', hoof: '#3b3128', beard: '#d6cbb2', line: '#6d604c' };
    const s = new Sprite();
    legs(s, [10, 13, 24, 27], 21, 30, c.coat, c.shade, c.hoof);
    s.oval(19, 17.5, 10.5, 4.5, c.coat);
    s.rect(26, 11, 29, 18, c.coat); // neck
    s.oval(31, 10.5, 3, 3, c.coat).rect(32, 10, 35, 13, c.coat); // head
    s.dots([[31, 7], [31, 6], [30, 5], [29, 4], [28, 4], [27, 5], [26, 6]], c.horn); // horn curving back
    s.rect(27, 9, 28, 10, c.shade); // ear
    s.rect(33, 14, 34, 16, c.beard);
    s.dots([[8, 13], [7, 12], [8, 12]], c.coat); // short tail up
    s.paint((m) => m.oval(15, 16, 3.5, 2.5, 1).oval(24, 18, 2, 2, 1), c.patch);
    s.dots([[32, 10]], '#111').dots([[35, 12]], c.patch);
    s.paint((m) => m.rect(9, 20, 29, 21, 1), c.shade);
    return s.outline(c.line);
  },

  cat() {
    const c = { coat: '#e39a4a', stripe: '#b8692a', chest: '#f6e7cf', pink: '#e79a9a', line: '#673712' };
    const s = new Sprite();
    legs(s, [13, 16, 24, 27], 25, 30, c.coat, c.stripe, c.chest);
    s.oval(21, 22, 8.5, 3.5, c.coat);
    s.oval(30, 18, 3.5, 3, c.coat); // head
    s.dots([[28, 14], [28, 15], [29, 15], [32, 14], [32, 15], [31, 15]], c.coat); // ears
    s.dots([[28, 15], [32, 15]], c.pink);
    s.rect(28, 21, 30, 24, c.chest).rect(32, 19, 33, 20, c.chest); // chest, muzzle
    s.dots([[31, 17]], '#2a3a1a').dots([[34, 19]], c.pink);
    s.dots([[13, 20], [12, 19], [11, 18], [11, 17], [11, 16], [12, 15], [13, 15]], c.coat); // tail curling up
    s.dots([[18, 19], [18, 20], [21, 19], [21, 20], [24, 19], [24, 20], [11, 17], [29, 16]], c.stripe);
    return s.outline(c.line);
  },
};

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function toPng(sprite) {
  const w = W * SCALE;
  const h = H * SCALE;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const colour = sprite.px[Math.floor(y / SCALE)][Math.floor(x / SCALE)];
      if (!colour) continue;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = parseInt(colour.slice(1, 3), 16);
      raw[o + 1] = parseInt(colour.slice(3, 5), 16);
      raw[o + 2] = parseInt(colour.slice(5, 7), 16);
      raw[o + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'animals');
mkdirSync(outDir, { recursive: true });
const only = process.argv.slice(2);
for (const [name, draw] of Object.entries(animals)) {
  if (only.length && !only.includes(name)) continue;
  writeFileSync(join(outDir, `${name}.png`), toPng(draw()));
}
console.log(`Wrote ${only.length || Object.keys(animals).length} animals to public/assets/animals/`);
