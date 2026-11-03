import { describe, expect, it } from 'vitest'
import { createApiKeyStore, type ApiKeyStoreDeps } from './apiKey'

function deps(encryptionAvailable = true): ApiKeyStoreDeps & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>()
  return {
    files,
    filePath: '/data/claude-api-key.bin',
    safeStorage: {
      isEncryptionAvailable: () => encryptionAvailable,
      // Reversible stand-in for the OS keychain: reverses the bytes.
      encryptString: (text) => Buffer.from(text, 'utf8').reverse(),
      decryptString: (buffer) => Buffer.from(buffer).reverse().toString('utf8')
    },
    fs: {
      existsSync: (path) => files.has(path),
      readFileSync: (path) => files.get(path)!,
      writeFileSync: (path, data) => void files.set(path, Buffer.from(data)),
      rmSync: (path) => void files.delete(path)
    }
  }
}

describe('api key store', () => {
  it('has no key at first', () => {
    const store = createApiKeyStore(deps())
    expect(store.has()).toBe(false)
    expect(store.get()).toBeNull()
  })

  it('stores the key encrypted and reads it back', () => {
    const d = deps()
    const store = createApiKeyStore(d)
    store.set('  sk-ant-secret-value  ')

    expect(store.has()).toBe(true)
    expect(store.get()).toBe('sk-ant-secret-value')
    expect(d.files.get(d.filePath)?.toString('utf8')).not.toContain('sk-ant-secret-value')
  })

  it('removes the key when set to an empty value', () => {
    const d = deps()
    const store = createApiKeyStore(d)
    store.set('sk-ant-secret-value')
    store.set('   ')
    expect(store.has()).toBe(false)
    expect(d.files.size).toBe(0)
  })

  it('refuses to store a key when OS encryption is unavailable', () => {
    const d = deps(false)
    expect(() => createApiKeyStore(d).set('sk-ant-secret-value')).toThrow(
      'Secure storage is not available'
    )
    expect(d.files.size).toBe(0)
  })
})
