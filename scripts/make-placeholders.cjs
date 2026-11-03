// Generates the placeholder pixel art in src/renderer/assets/. Every sprite is drawn on a tiny
// canvas and saved as a PNG; the app scales it up with `image-rendering: pixelated`.
//
// Run: node scripts/make-placeholders.cjs
// It only overwrites blank or previously generated placeholders (tagged with a PNG text chunk),
// so real art dropped into the folder is never replaced.
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const OUT = path.join(__dirname, '..', 'src', 'renderer', 'assets')
const MARKER = 'focusgarden-placeholder'

// ---------- PNG encoding ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(canvas) {
  const { w, h, px } = canvas
  const header = Buffer.alloc(13)
  header.writeUInt32BE(w, 0)
  header.writeUInt32BE(h, 4)
  header.set([8, 6, 0, 0, 0], 8) // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = px[y * w + x]
      if (c) raw.set(c, y * (w * 4 + 1) + 1 + x * 4)
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('tEXt', Buffer.from(`Software\0${MARKER}`, 'latin1')),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---------- Drawing ----------

const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  255
]

const C = {
  outline: rgb('#4c2802'),
  soil: rgb('#7a4a1c'),
  soilDark: rgb('#5c3510'),
  wood: rgb('#8c4c0c'),
  woodLight: rgb('#b0702a'),
  woodDark: rgb('#6b3806'),
  green: rgb('#5aa83c'),
  greenDark: rgb('#3d7f2a'),
  greenLight: rgb('#8fd05f'),
  pine: rgb('#2f6b3a'),
  pineLight: rgb('#3f8a4a'),
  white: rgb('#ffffff'),
  cloudShade: rgb('#d8eef7'),
  black: rgb('#2a2a2a'),
  red: rgb('#d8402e'),
  pink: rgb('#f2a0b0'),
  pinkDark: rgb('#d97a8c'),
  yellow: rgb('#f5c93a'),
  orange: rgb('#ef8a2a'),
  purple: rgb('#a77bd6'),
  purpleDark: rgb('#7d55ad'),
  brown: rgb('#8a5a2b'),
  brownLight: rgb('#b9864f'),
  grey: rgb('#9a9a9a'),
  greyLight: rgb('#c9c9c9'),
  tan: rgb('#d9b07a'),
  cream: rgb('#f3e7cf'),
  bronze: rgb('#c27a3a'),
  bronzeDark: rgb('#8f5424'),
  silver: rgb('#d4d8dc'),
  silverDark: rgb('#9aa1a8'),
  gold: rgb('#f2c230'),
  goldDark: rgb('#c08f12')
}

class Canvas {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.px = new Array(w * h).fill(null)
  }
  set(x, y, c) {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : null
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }
  disc(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5) this.set(x, y, c)
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c)
  }
  // Pixel-art outline: every empty pixel touching a filled one becomes the outline color.
  outline(c = C.outline) {
    const edge = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (
          !this.get(x, y) &&
          [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)].some(
            (p) => p && p !== c
          )
        )
          edge.push([x, y])
    for (const [x, y] of edge) this.set(x, y, c)
    return this
  }
}

// A tiny 3x5 pixel font for the logo and sign labels.
const GLYPHS = {
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  a: ['000', '011', '101', '101', '011'],
  c: ['000', '011', '100', '100', '011'],
  d: ['001', '011', '101', '101', '011'],
  e: ['000', '010', '111', '100', '011'],
  h: ['100', '110', '101', '101', '101'],
  m: ['00000', '11010', '10101', '10101', '10101'],
  n: ['000', '110', '101', '101', '101'],
  o: ['000', '010', '101', '101', '010'],
  r: ['000', '011', '100', '100', '100'],
  s: ['000', '011', '110', '001', '110'],
  u: ['000', '101', '101', '101', '011']
}
function text(cv, str, x, y, c) {
  for (const ch of str) {
    const g = GLYPHS[ch]
    g.forEach((row, j) => [...row].forEach((bit, i) => bit === '1' && cv.set(x + i, y + j, c)))
    x += g[0].length + 1
  }
}

// ---------- Plants (16x24, growing from a soil mound) ----------

const PW = 16
const PH = 24
const GROUND = PH - 3

function soil(cv) {
  cv.rect(4, GROUND + 1, 8, 2, C.soil)
  cv.rect(5, GROUND + 1, 6, 1, C.soilDark)
}

function sprout(cv) {
  cv.line(8, GROUND, 8, GROUND - 3, C.green)
  cv.set(7, GROUND - 3, C.greenLight)
  cv.set(6, GROUND - 4, C.greenLight)
  cv.set(9, GROUND - 3, C.green)
  cv.set(10, GROUND - 4, C.green)
}

function stem(cv, height, color = C.green) {
  cv.line(8, GROUND, 8, GROUND - height, color)
}

function leaves(cv, height, every, color = C.green, light = C.greenLight) {
  for (let y = GROUND - 2; y > GROUND - height; y -= every) {
    const left = (GROUND - y) % (every * 2) === 2
    const dir = left ? -1 : 1
    cv.set(8 + dir, y, color)
    cv.set(8 + dir * 2, y - 1, light)
    cv.set(8 + dir * 2, y, color)
  }
}

const PLANTS = {
  pine(cv, s) {
    const h = [0, 5, 8, 11, 15, 19][s - 1]
    cv.rect(7, GROUND - 2, 2, 3, C.brown)
    for (let y = 0; y < h; y++) {
      const half = Math.min(7, Math.floor(((y % 5) + 1 + y / 3) / 1.3))
      cv.rect(8 - half, GROUND - 2 - h + y, half * 2, 1, y % 5 < 2 ? C.pineLight : C.pine)
    }
    if (s === 6) cv.set(8, GROUND - 2 - h - 1, C.yellow)
  },
  apple(cv, s) {
    const trunk = [0, 4, 6, 8, 9, 10][s - 1]
    const r = [0, 3, 4, 5, 6, 7][s - 1]
    cv.rect(7, GROUND - trunk, 2, trunk + 1, C.brown)
    cv.disc(8, GROUND - trunk - r + 1, r, C.green)
    cv.disc(7, GROUND - trunk - r, r - 2, C.greenLight)
    const spots = [
      [5, -2],
      [10, -4],
      [7, -6],
      [11, 0],
      [4, -5]
    ]
    if (s >= 5)
      for (const [x, dy] of spots.slice(0, s === 5 ? 3 : 5))
        cv.set(x, GROUND - trunk - r + dy + 3, s === 5 ? C.white : C.red)
  },
  tomato(cv, s) {
    const h = [0, 6, 9, 12, 15, 17][s - 1]
    cv.rect(4, GROUND - h + 2, 1, h - 2, C.brownLight) // stake
    stem(cv, h)
    leaves(cv, h, 3)
    if (s === 5) [GROUND - 6, GROUND - 11].forEach((y) => cv.set(10, y, C.yellow))
    if (s === 6)
      [
        [10, GROUND - 5],
        [6, GROUND - 9],
        [10, GROUND - 12]
      ].forEach(([x, y]) => cv.disc(x, y, 1, C.red))
  },
  lilac(cv, s) {
    const r = [0, 3, 4, 5, 6, 6][s - 1]
    cv.disc(8, GROUND - r + 1, r, C.greenDark)
    cv.disc(8, GROUND - r, r - 1, C.green)
    if (s >= 5)
      [
        [5, -2],
        [9, -4],
        [11, -1]
      ].forEach(([x, dy]) => {
        const top = GROUND - r * 2 + dy + 3
        cv.rect(x, top, 2, s === 6 ? 4 : 2, C.purple)
        cv.set(x, top, C.purpleDark)
      })
  },
  corn(cv, s) {
    const h = [0, 7, 10, 14, 17, 20][s - 1]
    stem(cv, h, C.greenDark)
    for (let y = GROUND - 3; y > GROUND - h + 2; y -= 4) {
      const dir = (GROUND - y) % 8 === 3 ? -1 : 1
      cv.line(8 + dir, y, 8 + dir * 4, y + 2, C.green)
    }
    if (s >= 5) cv.rect(7, GROUND - h - 2, 3, 2, C.yellow)
    if (s === 6) {
      cv.rect(9, GROUND - 11, 2, 5, C.yellow)
      cv.rect(11, GROUND - 10, 1, 4, C.greenLight)
    }
  },
  sunflower(cv, s) {
    const h = [0, 7, 10, 13, 16, 18][s - 1]
    stem(cv, h)
    leaves(cv, h - 2, 4)
    if (s === 5) cv.disc(8, GROUND - h - 1, 1.5, C.greenLight)
    if (s === 6) {
      cv.disc(8, GROUND - h - 2, 3.5, C.yellow)
      cv.disc(8, GROUND - h - 2, 1.5, C.brown)
    }
  },
  succulent(cv, s) {
    const r = [0, 2, 3, 4, 5, 6][s - 1]
    for (let i = 0; i < r; i++) {
      cv.rect(8 - r + i, GROUND - i * 1.2, (r - i) * 2, 1, i % 2 ? C.greenLight : C.green)
    }
    cv.set(8 - r, GROUND - 1, C.pink)
    cv.set(8 + r - 1, GROUND - 1, C.pink)
    if (s === 6) {
      cv.line(8, GROUND - r, 8, GROUND - r - 5, C.green)
      cv.set(8, GROUND - r - 6, C.pink)
      cv.set(9, GROUND - r - 5, C.pink)
    }
  },
  basil(cv, s) {
    const h = [0, 5, 7, 9, 11, 12][s - 1]
    stem(cv, h)
    for (let y = GROUND - 1; y > GROUND - h; y -= 2) {
      const w = Math.max(2, Math.round((GROUND - y) / 2.5) + 1)
      cv.disc(8 - w / 2, y, 1.2, C.greenLight)
      cv.disc(8 + w / 2, y, 1.2, C.green)
    }
    if (s === 6) cv.rect(8, GROUND - h - 3, 1, 3, C.white)
    if (s === 5) cv.set(8, GROUND - h - 1, C.white)
  },
  carrot(cv, s) {
    const h = [0, 5, 7, 9, 10, 11][s - 1]
    for (const dx of [-3, -1, 1, 3]) {
      cv.line(8, GROUND, 8 + dx, GROUND - h + Math.abs(dx), C.green)
      cv.set(8 + dx, GROUND - h + Math.abs(dx) - 1, C.greenLight)
    }
    if (s >= 4) cv.rect(7, GROUND, 3, s === 6 ? 3 : 2, C.orange)
  },
  monkeygrass(cv, s) {
    const h = [0, 5, 7, 9, 11, 12][s - 1]
    for (const dx of [-4, -2, 0, 2, 4]) {
      const top = GROUND - h + Math.abs(dx)
      cv.line(8 + dx / 2, GROUND, 8 + dx, top, dx % 4 === 0 ? C.greenDark : C.pine)
    }
    if (s === 6)
      for (const dx of [-1, 1]) {
        cv.line(8 + dx, GROUND - 2, 8 + dx, GROUND - h + 2, C.green)
        cv.set(8 + dx, GROUND - h + 1, C.purpleDark)
        cv.set(8 + dx, GROUND - h + 3, C.purpleDark)
      }
  }
}

function plant(name, stage) {
  const cv = new Canvas(PW, PH)
  if (stage === 1) sprout(cv)
  else PLANTS[name](cv, stage)
  cv.outline()
  soil(cv)
  return cv
}

// ---------- Animals (20x16, facing right) ----------

function quadruped(o) {
  const cv = new Canvas(20, 16)
  const legTop = o.legTop ?? 11
  for (const x of [4, 6, 11, 13]) {
    cv.rect(x, legTop, 1, 14 - legTop, o.legs ?? o.body)
    cv.set(x, 14, o.hoof ?? o.legs ?? o.body)
  }
  cv.rect(3, o.bodyTop ?? 6, 12, legTop - (o.bodyTop ?? 6), o.body)
  if (o.belly) cv.rect(5, legTop - 1, 8, 1, o.belly)
  if (o.spots)
    [
      [5, 7],
      [6, 7],
      [10, 8],
      [11, 9],
      [8, 10]
    ].forEach(([x, y]) => cv.set(x, y, o.spots))
  if (o.fluff) for (let x = 3; x < 15; x += 2) [5, 11].forEach((y) => cv.set(x + 1, y, o.body))
  // neck and head
  const hy = o.headY ?? 3
  cv.rect(13, hy + 2, 3, 4, o.neck ?? o.body)
  cv.rect(14, hy, 4, 4, o.head ?? o.body)
  cv.rect(18, hy + 2, o.snoutW ?? 1, 2, o.snout ?? o.head ?? o.body)
  cv.set(16, hy + 1, C.black) // eye
  if (o.mane) cv.rect(13, hy, 1, 5, o.mane)
  if (o.ears === 'pointy') {
    cv.set(14, hy - 1, o.head ?? o.body)
    cv.set(17, hy - 1, o.head ?? o.body)
  } else if (o.ears === 'long') {
    cv.rect(14, hy - 3, 1, 3, o.head ?? o.body)
    cv.rect(16, hy - 3, 1, 3, o.head ?? o.body)
  } else if (o.ears === 'floppy') {
    cv.rect(14, hy + 1, 1, 3, o.earColor ?? o.body)
  } else if (o.ears === 'horns') {
    cv.set(14, hy - 1, o.hornColor ?? C.cream)
    cv.set(15, hy - 2, o.hornColor ?? C.cream)
  }
  if (o.beard) cv.rect(17, hy + 4, 1, 2, o.beard)
  // tail
  if (o.tail === 'up') cv.line(2, 6, 1, 3, o.tailColor ?? o.body)
  else if (o.tail === 'curl') {
    cv.set(2, 6, o.body)
    cv.set(1, 5, o.body)
    cv.set(2, 4, o.body)
  } else cv.line(2, 7, 1, 10, o.tailColor ?? o.body)
  return cv.outline()
}

function bird(o) {
  const cv = new Canvas(20, 16)
  cv.disc(9, 9, 4, o.body)
  cv.rect(5, 7, 3, 4, o.body)
  cv.rect(11, 3, 3, 6, o.body) // neck
  cv.disc(13, 4, 2, o.body) // head
  cv.set(14, 3, C.black)
  cv.rect(15, 4, o.billW ?? 1, 1, o.bill)
  if (o.billW) cv.rect(15, 5, o.billW, 1, o.bill)
  cv.rect(7, 8, 4, 2, o.wing)
  if (o.comb) {
    cv.rect(12, 1, 3, 1, o.comb)
    cv.set(15, 6, o.comb)
  }
  cv.rect(8, 13, 1, 2, o.feet)
  cv.rect(10, 13, 1, 2, o.feet)
  cv.set(9, 14, o.feet)
  cv.set(11, 14, o.feet)
  return cv.outline()
}

const ANIMALS = {
  cow: () =>
    quadruped({ body: C.white, spots: C.black, snout: C.pink, ears: 'horns', hoof: C.black }),
  horse: () =>
    quadruped({
      body: C.brown,
      mane: C.woodDark,
      tailColor: C.woodDark,
      headY: 2,
      snoutW: 2,
      ears: 'pointy',
      hoof: C.black
    }),
  pig: () =>
    quadruped({
      body: C.pink,
      snout: C.pinkDark,
      legTop: 12,
      bodyTop: 6,
      ears: 'pointy',
      tail: 'curl'
    }),
  sheep: () =>
    quadruped({
      body: C.white,
      fluff: true,
      head: C.black,
      legs: C.black,
      ears: 'floppy',
      earColor: C.black,
      neck: C.white
    }),
  dog: () =>
    quadruped({
      body: C.tan,
      ears: 'floppy',
      earColor: C.brown,
      snout: C.cream,
      tail: 'up',
      spots: C.brownLight
    }),
  donkey: () =>
    quadruped({
      body: C.grey,
      belly: C.greyLight,
      snout: C.greyLight,
      ears: 'long',
      mane: C.black,
      hoof: C.black
    }),
  goat: () =>
    quadruped({
      body: C.greyLight,
      ears: 'horns',
      hornColor: C.tan,
      beard: C.grey,
      tail: 'up',
      hoof: C.black
    }),
  cat: () =>
    quadruped({
      body: C.orange,
      legTop: 12,
      bodyTop: 7,
      headY: 4,
      ears: 'pointy',
      tail: 'up',
      spots: C.yellow
    }),
  duck: () => bird({ body: C.white, wing: C.greyLight, bill: C.orange, billW: 2, feet: C.orange }),
  chicken: () => bird({ body: C.cream, wing: C.tan, bill: C.yellow, comb: C.red, feet: C.yellow })
}

// ---------- UI ----------

function cloud() {
  const cv = new Canvas(32, 16)
  cv.disc(9, 9, 5, C.white)
  cv.disc(16, 6, 6, C.white)
  cv.disc(23, 9, 5, C.white)
  cv.rect(6, 9, 21, 5, C.white)
  cv.rect(6, 13, 21, 1, C.cloudShade)
  return cv.outline(C.cloudShade)
}

// A wagon wheel; the app spins it in quarter steps.
function spinner() {
  const cv = new Canvas(15, 15)
  cv.disc(7, 7, 6, C.wood)
  cv.disc(7, 7, 4.5, null)
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ])
    cv.line(7 - dx * 5, 7 - dy * 5, 7 + dx * 5, 7 + dy * 5, C.woodLight)
  cv.disc(7, 7, 1, C.woodDark)
  return cv.outline()
}

function trophy(metal, dark) {
  const cv = new Canvas(14, 16)
  cv.rect(3, 1, 8, 6, metal)
  cv.rect(4, 7, 6, 1, metal)
  cv.rect(5, 8, 4, 1, metal)
  cv.rect(6, 9, 2, 3, dark)
  cv.rect(4, 12, 6, 2, dark)
  cv.rect(1, 2, 2, 1, metal)
  cv.rect(1, 2, 1, 3, metal)
  cv.rect(11, 2, 2, 1, metal)
  cv.rect(12, 2, 1, 3, metal)
  cv.set(5, 2, C.white)
  cv.set(5, 3, C.white)
  return cv.outline()
}

function logo() {
  const cv = new Canvas(58, 11)
  // seedling in a pot
  cv.rect(2, 6, 6, 3, C.wood)
  cv.rect(1, 5, 8, 1, C.woodLight)
  cv.line(5, 5, 5, 2, C.green)
  cv.set(4, 2, C.greenLight)
  cv.set(3, 1, C.greenLight)
  cv.set(6, 2, C.green)
  cv.set(7, 1, C.green)
  cv.outline()
  text(cv, 'FocusGarden', 12, 3, C.outline)
  return cv
}

function homeSign(board, post) {
  const cv = new Canvas(24, 18)
  cv.rect(11, 9, 2, 8, post)
  cv.rect(1, 2, 22, 8, board)
  cv.rect(1, 2, 22, 1, board === C.wood ? C.woodLight : C.greyLight)
  cv.outline()
  text(cv, 'home', 4, 4, C.cream)
  return cv
}

function fence() {
  const cv = new Canvas(16, 16)
  for (const x of [1, 9]) {
    cv.rect(x, 2, 5, 13, C.woodLight)
    cv.set(x, 2, null)
    cv.set(x + 4, 2, null)
  }
  cv.rect(0, 5, 16, 2, C.wood)
  cv.rect(0, 11, 16, 2, C.wood)
  return cv.outline()
}

function gate() {
  const cv = new Canvas(16, 16)
  cv.rect(1, 2, 2, 13, C.wood)
  cv.rect(13, 2, 2, 13, C.wood)
  for (const y of [4, 8, 12]) cv.rect(3, y, 10, 2, C.woodLight)
  cv.line(3, 13, 12, 4, C.wood)
  return cv.outline()
}

// ---------- Write ----------

const PLANT_FILES = {
  pine: 'pine',
  apple: 'apple',
  tomato: 'tomato',
  lilac: 'lilac',
  corn: 'corn',
  sunflower: 'sunflower',
  succulent: 'succulent',
  basil: 'basil',
  carrot: 'carrot',
  monkeygrass: 'monkeygrass'
}

const sprites = {
  ...Object.fromEntries(
    Object.keys(PLANT_FILES).flatMap((p) =>
      [1, 2, 3, 4, 5, 6].map((s) => [`plants/${p}-stage${s}.png`, () => plant(p, s)])
    )
  ),
  ...Object.fromEntries(Object.entries(ANIMALS).map(([a, draw]) => [`animals/${a}.png`, draw])),
  'ui/cloud.png': cloud,
  'ui/spinner.png': spinner,
  'ui/logo.png': logo,
  'ui/trophy-bronze.png': () => trophy(C.bronze, C.bronzeDark),
  'ui/trophy-silver.png': () => trophy(C.silver, C.silverDark),
  'ui/trophy-gold.png': () => trophy(C.gold, C.goldDark),
  'ui/home-sign-active.png': () => homeSign(C.wood, C.woodDark),
  'ui/home-sign-inactive.png': () => homeSign(C.grey, C.greyLight),
  'ui/fence.png': fence,
  'ui/gate.png': gate
}

// Real art is never overwritten: only missing files, blank 1x1 PNGs, or our own output.
function replaceable(file) {
  if (!fs.existsSync(file)) return true
  const data = fs.readFileSync(file)
  return data.includes(MARKER) || (data.readUInt32BE(16) === 1 && data.readUInt32BE(20) === 1)
}

function writeAll() {
  let written = 0
  let kept = 0
  for (const [rel, draw] of Object.entries(sprites)) {
    const file = path.join(OUT, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (!replaceable(file)) {
      kept++
      continue
    }
    fs.writeFileSync(file, encodePng(draw()))
    written++
  }
  console.log(`Wrote ${written} placeholder images${kept ? `, kept ${kept} real ones` : ''}`)
}

if (require.main === module) writeAll()

module.exports = { sprites, encodePng, Canvas }
