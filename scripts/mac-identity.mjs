// The local code-signing identity created by scripts/setup-mac-signing.mjs.
import { execFileSync } from 'node:child_process'

export const MAC_DEV_IDENTITY = 'FocusGarden Dev'

// True when that certificate exists in the keychain and is trusted for code signing.
export function hasMacDevIdentity() {
  if (process.platform !== 'darwin') return false
  try {
    const out = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
      encoding: 'utf8'
    })
    return out.includes(`"${MAC_DEV_IDENTITY}"`)
  } catch {
    return false
  }
}
