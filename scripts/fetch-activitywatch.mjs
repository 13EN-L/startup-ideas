// Downloads the ActivityWatch build that ships inside FocusGarden into
// vendor/<platform>/activitywatch/, where electron-builder picks it up.
// The archive is pinned by version and SHA-256; a mismatch aborts the build.
//
//   node scripts/fetch-activitywatch.mjs [platform]   (default: this machine's)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = 'v0.14.1';
const RELEASES = `https://github.com/ActivityWatch/activitywatch/releases/download/${VERSION}`;
const LICENSE_URL = `https://raw.githubusercontent.com/ActivityWatch/activitywatch/${VERSION}/LICENSE.txt`;

// Only Windows is bundled for now; other platforms keep the in-app download link.
const BUILDS = {
  win32: {
    asset: `activitywatch-${VERSION}-windows-x86_64.zip`,
    sha256: 'f6aa42ff1d898258379958028fc8c181dfe65439c07eeba8e7e7c13865e446ca',
    launcher: 'aw-qt.exe',
  },
};

const platform = process.argv[2] ?? process.platform;
const build = BUILDS[platform];
if (!build) {
  console.log(`ActivityWatch is not bundled for ${platform}; skipping.`);
  process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'vendor', platform, 'activitywatch');
const marker = join(target, 'FOCUSGARDEN_BUNDLED_VERSION');

if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === `${VERSION} ${build.sha256}`) {
  console.log(`ActivityWatch ${VERSION} already in ${target}`);
  process.exit(0);
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
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
  const extracted = join(work, 'extracted');
  mkdirSync(extracted);
  // bsdtar (built into Windows 10+, macOS and most Linux) unpacks zip files too.
  execFileSync('tar', ['-xf', archivePath, '-C', extracted]);

  const unpacked = join(extracted, 'activitywatch');
  if (!existsSync(join(unpacked, build.launcher))) {
    throw new Error(`${build.launcher} not found in ${build.asset}; the archive layout changed.`);
  }

  // ActivityWatch is MPL-2.0; its licence travels with every copy we ship.
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
  rmSync(target, { recursive: true, force: true });
  cpSync(unpacked, target, { recursive: true });
  console.log(`ActivityWatch ${VERSION} ready in ${target}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
