// One-time macOS setup: creates a self-signed "FocusGarden Dev" code-signing certificate in
// your login keychain, so every local build is signed with the same identity. macOS then keeps
// FocusGarden's Accessibility permission and keychain access across rebuilds instead of asking
// again each time. Only for building on your own Mac; to share the app, sign it with an Apple
// Developer ID instead.
//
//   node scripts/setup-mac-signing.mjs
//
// macOS asks for your password once, to trust the certificate for code signing. Undo it in
// Keychain Access: delete the "FocusGarden Dev" certificate and its private key.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAC_DEV_IDENTITY, hasMacDevIdentity } from './mac-identity.mjs'

if (process.platform !== 'darwin') {
  console.error('This setup is only for macOS.')
  process.exit(1)
}
if (hasMacDevIdentity()) {
  console.log(`"${MAC_DEV_IDENTITY}" is already set up; builds are signed with it.`)
  process.exit(0)
}

const keychain = join(homedir(), 'Library', 'Keychains', 'login.keychain-db')
const work = mkdtempSync(join(tmpdir(), 'focusgarden-cert-'))
// macOS's own LibreSSL writes a .p12 that `security import` reads (Homebrew OpenSSL 3 doesn't).
const openssl = '/usr/bin/openssl'
const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: work, stdio: ['ignore', 'pipe', 'inherit'] })

try {
  writeFileSync(
    join(work, 'cert.cnf'),
    [
      '[req]',
      'distinguished_name = dn',
      'x509_extensions = ext',
      'prompt = no',
      '[dn]',
      `CN = ${MAC_DEV_IDENTITY}`,
      '[ext]',
      'basicConstraints = critical, CA:false',
      'keyUsage = critical, digitalSignature',
      'extendedKeyUsage = critical, codeSigning',
      ''
    ].join('\n')
  )
  run(openssl, [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '3650',
    '-keyout',
    'key.pem',
    '-out',
    'cert.pem',
    '-config',
    'cert.cnf'
  ])
  // A throwaway password only protects the file in transit to the keychain; it's deleted below.
  run(openssl, [
    'pkcs12',
    '-export',
    '-inkey',
    'key.pem',
    '-in',
    'cert.pem',
    '-out',
    'identity.p12',
    '-passout',
    'pass:focusgarden'
  ])
  // Only codesign may use the private key without asking.
  run('security', [
    'import',
    'identity.p12',
    '-k',
    keychain,
    '-P',
    'focusgarden',
    '-T',
    '/usr/bin/codesign'
  ])
  console.log('Trusting the certificate for code signing (macOS will ask for your password)…')
  run('security', [
    'add-trusted-cert',
    '-r',
    'trustRoot',
    '-p',
    'codeSign',
    '-k',
    keychain,
    'cert.pem'
  ])
} finally {
  rmSync(work, { recursive: true, force: true })
}

if (!hasMacDevIdentity()) {
  console.error(`Setup finished but "${MAC_DEV_IDENTITY}" isn't a valid signing identity.`)
  process.exit(1)
}
console.log(`Done. Builds will now be signed as "${MAC_DEV_IDENTITY}".`)
console.log(
  'Rebuild with npm run build:unpack, then grant Accessibility to FocusGarden one last time.'
)
