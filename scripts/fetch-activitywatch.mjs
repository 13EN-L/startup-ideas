// Downloads the ActivityWatch build that ships inside FocusGarden into
// vendor/<target>/activitywatch/, where electron-builder picks it up.
// Every download is pinned by version and SHA-256; a mismatch aborts the build.
//
//   node scripts/fetch-activitywatch.mjs [platform]   (default: this machine's)
//
// Targets: win32 (aw-qt.exe and friends, from the portable zip) and
// darwin-arm64 / darwin-x64 (ActivityWatch.app, from the .dmg; macOS only,
// since opening a .dmg needs hdiutil). "darwin" fetches both Mac targets.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = 'v0.14.1';
const RELEASES = `https://github.com/ActivityWatch/activitywatch/releases/download/${VERSION}`;
const LICENSE_URL = `https://raw.githubusercontent.com/ActivityWatch/activitywatch/${VERSION}/LICENSE.txt`;

// Checksums are the ones GitHub publishes for each release asset.
const BUILDS = {
  win32: {
    asset: `activitywatch-${VERSION}-windows-x86_64.zip`,
    sha256: 'f6aa42ff1d898258379958028fc8c181dfe65439c07eeba8e7e7c13865e446ca',
    unpack: unpackZip,
    launcher: 'aw-qt.exe',
  },
  'darwin-arm64': {
    asset: `activitywatch-${VERSION}-macos-arm64.dmg`,
    sha256: '225916c1e641151638a062c796743ea21ba29c5d1bc162d84fc5591473d822db',
    unpack: unpackDmg,
    launcher: 'ActivityWatch.app',
  },
  'darwin-x64': {
    asset: `activitywatch-${VERSION}-macos-x86_64.dmg`,
    sha256: 'd10abf59d0c86a4cbf137b455326201b4fc6691a84d63b47c58779c90e1169ff',
    unpack: unpackDmg,
    launcher: 'ActivityWatch.app',
  },
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** The portable zip unpacks to an activitywatch/ folder holding aw-qt.exe. */
function unpackZip(archivePath, work) {
  const extracted = join(work, 'extracted');
  mkdirSync(extracted);
  // bsdtar (built into Windows 10+, macOS and most Linux) unpacks zip files too.
  execFileSync('tar', ['-xf', archivePath, '-C', extracted]);
  return join(extracted, 'activitywatch');
}

/** The .dmg holds a signed ActivityWatch.app; copy it out with its symlinks and signature intact. */
function unpackDmg(archivePath, work) {
  if (process.platform !== 'darwin') {
    throw new Error('The macOS ActivityWatch comes as a .dmg, which can only be opened on a Mac. Run this on macOS.');
  }
  const mount = join(work, 'mount');
  const unpacked = join(work, 'activitywatch');
  mkdirSync(mount);
  mkdirSync(unpacked);
  execFileSync('hdiutil', ['attach', archivePath, '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mount]);
  try {
    const app = readdirSync(mount).find((name) => name.endsWith('.app'));
    if (!app) throw new Error('No .app found in the ActivityWatch disk image; the layout changed.');
    // ditto keeps framework symlinks, permissions and the code signature.
    execFileSync('ditto', [join(mount, app), join(unpacked, 'ActivityWatch.app')]);
  } finally {
    execFileSync('hdiutil', ['detach', mount, '-force']);
  }
  return unpacked;
}

async function fetchBuild(name, build) {
  const target = join(root, 'vendor', name, 'activitywatch');
  const marker = join(target, 'FOCUSGARDEN_BUNDLED_VERSION');
  if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === `${VERSION} ${build.sha256}`) {
    console.log(`ActivityWatch ${VERSION} already in ${target}`);
    return;
  }

  // Untrusted download: it gets its own empty folder and is only unpacked once
  // the checksum matches.
  const work = mkdtempSync(join(tmpdir(), 'focusgarden-aw-'));
  try {
    console.log(`Downloading ${build.asset} …`);
    const archive = await download(`${RELEASES}/${build.asset}`);
    const actual = createHash('sha256').update(archive).digest('hex');
    if (actual !== build.sha256) {
      throw new Error(`Checksum mismatch for ${build.asset}: expected ${build.sha256}, got ${actual}`);
    }

    const archivePath = join(work, build.asset);
    writeFileSync(archivePath, archive);
    const unpacked = build.unpack(archivePath, work);
    if (!existsSync(join(unpacked, build.launcher))) {
      throw new Error(`${build.launcher} not found in ${build.asset}; the archive layout changed.`);
    }

    // ActivityWatch is MPL-2.0; its licence travels with every copy we ship.
    // These sit beside the app, never inside it, so its signature is untouched.
    writeFileSync(join(unpacked, 'LICENSE.txt'), await download(LICENSE_URL));
    writeFileSync(
      join(unpacked, 'NOTICE.txt'),
      [
        `This folder contains ActivityWatch ${VERSION}, redistributed unmodified with FocusGarden.`,
        'ActivityWatch is licensed under the Mozilla Public License 2.0 (see LICENSE.txt).',
        `Source code: https://github.com/ActivityWatch/activitywatch/tree/${VERSION}`,
        '',
      ].join('\n'),
    );
    writeFileSync(join(unpacked, 'FOCUSGARDEN_BUNDLED_VERSION'), `${VERSION} ${build.sha256}\n`);

    // Copy rather than rename: the temp folder may be on another drive.
    // verbatimSymlinks keeps the app's relative framework links as they are.
    rmSync(target, { recursive: true, force: true });
    cpSync(unpacked, target, { recursive: true, verbatimSymlinks: true });
    console.log(`ActivityWatch ${VERSION} ready in ${target}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const requested = process.argv[2] ?? process.platform;
const names = requested === 'darwin' ? ['darwin-arm64', 'darwin-x64'] : [requested];
for (const name of names) {
  const build = BUILDS[name];
  if (!build) {
    console.log(`ActivityWatch is not bundled for ${name}; skipping.`);
    continue;
  }
  await fetchBuild(name, build);
}
