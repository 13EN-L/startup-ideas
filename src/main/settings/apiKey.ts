// The user's Claude API key, encrypted with Electron's safeStorage (backed by the OS keychain)
// and kept in its own file. Never in SQLite, config files, or logs.
export interface ApiKeyStoreDeps {
  filePath: string
  safeStorage: {
    isEncryptionAvailable(): boolean
    encryptString(plainText: string): Buffer
    decryptString(encrypted: Buffer): string
  }
  fs: {
    existsSync(path: string): boolean
    readFileSync(path: string): Buffer
    writeFileSync(path: string, data: Buffer): void
    rmSync(path: string, options?: { force?: boolean }): void
  }
}

export interface ApiKeyStore {
  set(key: string): void // an empty key removes the stored one
  get(): string | null
  has(): boolean
}

export function createApiKeyStore({ filePath, safeStorage, fs }: ApiKeyStoreDeps): ApiKeyStore {
  return {
    set(key) {
      const trimmed = key.trim()
      if (!trimmed) {
        fs.rmSync(filePath, { force: true })
        return
      }
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Secure storage is not available, so the API key was not saved')
      }
      fs.writeFileSync(filePath, safeStorage.encryptString(trimmed))
    },
    get() {
      if (!fs.existsSync(filePath)) return null
      return safeStorage.decryptString(fs.readFileSync(filePath))
    },
    has() {
      return fs.existsSync(filePath)
    }
  }
}
