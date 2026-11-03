// Downloads the pinned ActivityWatch release and keeps only the 3 parts FocusGarden bundles:
// the server and the window and AFK watchers. The download is checked against the SHA-256
// digest GitHub publishes for the release asset. Build time only; the app itself never
// downloads anything.
//
//   node scripts/fetch-activitywatch.mjs [--platform macos-arm64|macos-x86_64|windows-x86_64|linux-x86_64]
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const AW_VERSION = 'v0.14.1'
const SHA256 = {
  'macos-arm64': '47131f3546dd97fa449a3834f4b88e829efae54a4adf0d7a7547d079735285ea',
  'macos-x86_64': '4a35c1830738f7efa1bc59a0195c4c926efd0f9d1643262d157642b45271f48c',
  'windows-x86_64': 'f6aa42ff1d898258379958028fc8c181dfe65439c07eeba8e7e7c13865e446ca',
  'linux-x86_64': '211514a8912c0a399a8c7048101b699e0a2fedb5e81b5ed224304d5c8e091f2a'
}
const PARTS = ['aw-server-rust', 'aw-watcher-afk', 'aw-watcher-window']

const HOST_PLATFORM = {
  'darwin-arm64': 'macos-arm64',
  'darwin-x64': 'macos-x86_64',
  'win32-x64': 'windows-x86_64',
  'linux-x64': 'linux-x86_64'
}[`${process.platform}-${process.arch}`]

const flag = process.argv.indexOf('--platform')
const platform = flag === -1 ? HOST_PLATFORM : process.argv[flag + 1]
if (!SHA256[platform]) {
  console.error(`Unsupported platform "${platform}". Use one of: ${Object.keys(SHA256).join(', ')}`)
  process.exit(1)
}

const root = resolve(import.meta.dirname, '..')
const out = join(root, 'resources', 'activitywatch')
const stamp = `${AW_VERSION} ${platform}`
const stampFile = join(out, 'VERSION')

if (existsSync(stampFile) && readFileSync(stampFile, 'utf8').trim() === stamp) {
  console.log(`ActivityWatch ${stamp} is already in resources/activitywatch`)
  process.exit(0)
}

const asset = `activitywatch-${AW_VERSION}-${platform}.zip`
const url = `https://github.com/ActivityWatch/activitywatch/releases/download/${AW_VERSION}/${asset}`
console.log(`Downloading ${asset}…`)
const response = await fetch(url)
if (!response.ok) throw new Error(`Download failed: HTTP ${response.status} for ${url}`)
const zip = Buffer.from(await response.arrayBuffer())

const digest = createHash('sha256').update(zip).digest('hex')
if (digest !== SHA256[platform]) {
  throw new Error(`Checksum mismatch for ${asset}: expected ${SHA256[platform]}, got ${digest}`)
}

const work = mkdtempSync(join(tmpdir(), 'focusgarden-aw-'))
try {
  const zipPath = join(work, asset)
  writeFileSync(zipPath, zip)
  const wanted = [...PARTS.map((p) => `activitywatch/${p}/*`), 'activitywatch/media/LICENSE']
  // bsdtar (macOS, Windows 10+) reads zips; on Linux use unzip. Both keep executable bits.
  if (process.platform === 'linux') {
    execFileSync('unzip', ['-q', zipPath, ...wanted, '-d', work])
  } else {
    execFileSync('tar', [
      '-xf',
      zipPath,
      '-C',
      work,
      ...PARTS.map((p) => `activitywatch/${p}`),
      'activitywatch/media/LICENSE'
    ])
  }

  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  for (const part of PARTS) {
    cpSync(join(work, 'activitywatch', part), join(out, part), {
      recursive: true,
      verbatimSymlinks: true
    })
  }
  cpSync(join(work, 'activitywatch', 'media', 'LICENSE'), join(out, 'LICENSE.txt'))
  writeFileSync(stampFile, `${stamp}\n`)
  console.log(`ActivityWatch ${stamp} → resources/activitywatch (${PARTS.join(', ')})`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
