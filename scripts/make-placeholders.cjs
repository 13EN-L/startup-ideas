const fs = require('fs')
const path = require('path')

// 1x1 transparent PNG
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)
const out = path.join(__dirname, '..', 'src', 'renderer', 'assets')
const plants = [
  'pine',
  'tomato',
  'apple',
  'lilac',
  'corn',
  'sunflower',
  'succulent',
  'basil',
  'carrot',
  'monkeygrass'
]
const animals = ['cow', 'horse', 'pig', 'sheep', 'dog', 'duck', 'chicken', 'donkey', 'goat', 'cat']
const files = [
  ...plants.flatMap((p) => [1, 2, 3, 4, 5, 6].map((s) => `plants/${p}-stage${s}.png`)),
  ...animals.map((a) => `animals/${a}.png`),
  'ui/cloud.png',
  'ui/logo.png',
  'ui/spinner.png',
  'ui/trophy-bronze.png',
  'ui/trophy-silver.png',
  'ui/trophy-gold.png',
  'ui/home-sign-active.png',
  'ui/home-sign-inactive.png',
  'ui/fence.png',
  'ui/gate.png'
]
for (const f of files) {
  const p = path.join(out, f)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  if (!fs.existsSync(p)) fs.writeFileSync(p, png)
}
console.log(`Created ${files.length} placeholder images`)
