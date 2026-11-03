// Runs electron-builder with the given arguments (e.g. --dir, --mac). On a Mac set up with
// scripts/setup-mac-signing.mjs it signs with that stable identity; otherwise it uses the
// ad-hoc signature from electron-builder.yml.
import { spawnSync } from 'node:child_process'
import { MAC_DEV_IDENTITY, hasMacDevIdentity } from './mac-identity.mjs'

const args = process.argv.slice(2)
if (hasMacDevIdentity()) {
  args.push(`-c.mac.identity=${MAC_DEV_IDENTITY}`)
  console.log(`Signing as "${MAC_DEV_IDENTITY}"`)
} else if (process.platform === 'darwin') {
  console.log('Ad-hoc signing (run node scripts/setup-mac-signing.mjs for a stable identity)')
}

const result = spawnSync('electron-builder', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32'
})
process.exit(result.status ?? 1)
