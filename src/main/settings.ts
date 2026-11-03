// In-app setup: the Anthropic API key, stored encrypted by the OS, so users
// never have to set environment variables.
import type { StateStore } from '../core/persistence';
import type { ApiKeySource, SaveApiKeyResult } from '../shared/bridge';

/** The subset of Electron's safeStorage used here. */
export interface KeyCipher {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export interface SettingsStore {
  getApiKey(): Promise<string | null>;
  setApiKey(key: string): Promise<void>;
  clearApiKey(): Promise<void>;
}

interface SettingsFile {
  apiKey?: { encoding: 'os-encrypted' | 'plain'; value: string };
}

/** Returns a message explaining what is wrong, or null if the key looks right. */
export function checkApiKeyFormat(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) return 'Paste your Anthropic API key.';
  if (/\s/.test(trimmed)) return 'API keys contain no spaces. Check that you copied the whole key.';
  if (!trimmed.startsWith('sk-ant-')) return 'Anthropic API keys start with "sk-ant-".';
  if (trimmed.length < 20) return 'That key looks too short. Check that you copied the whole key.';
  return null;
}

export function resolveApiKey(
  savedKey: string | null,
  environmentKey: string | undefined,
): { key: string | null; source: ApiKeySource } {
  if (savedKey) return { key: savedKey, source: 'saved' };
  const env = environmentKey?.trim();
  if (env) return { key: env, source: 'environment' };
  return { key: null, source: 'missing' };
}

export function createSettingsStore(file: StateStore, cipher: KeyCipher): SettingsStore {
  async function read(): Promise<SettingsFile> {
    try {
      const raw = await file.load();
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? (parsed as SettingsFile) : {};
    } catch {
      return {};
    }
  }

  return {
    async getApiKey() {
      const { apiKey } = await read();
      if (!apiKey || typeof apiKey.value !== 'string') return null;
      try {
        if (apiKey.encoding === 'os-encrypted') {
          return cipher.decryptString(Buffer.from(apiKey.value, 'base64'));
        }
        if (apiKey.encoding === 'plain') return apiKey.value;
      } catch {
        // Encrypted on another computer or by another user account.
      }
      return null;
    },

    async setApiKey(key) {
      const settings = await read();
      settings.apiKey = cipher.isEncryptionAvailable()
        ? { encoding: 'os-encrypted', value: cipher.encryptString(key).toString('base64') }
        : { encoding: 'plain', value: key };
      await file.save(JSON.stringify(settings, null, 2));
    },

    async clearApiKey() {
      const settings = await read();
      delete settings.apiKey;
      await file.save(JSON.stringify(settings, null, 2));
    },
  };
}

export type KeyVerdict = 'valid' | 'invalid' | 'unknown';

export async function saveApiKey(
  rawKey: string,
  deps: { store: SettingsStore; verify: (key: string) => Promise<KeyVerdict> },
): Promise<SaveApiKeyResult> {
  const formatError = checkApiKeyFormat(rawKey);
  if (formatError) return { ok: false, error: formatError };

  const key = rawKey.trim();
  const verdict = await deps.verify(key);
  if (verdict === 'invalid') {
    return { ok: false, error: 'Anthropic rejected this key. Check it in the Claude Console and try again.' };
  }

  await deps.store.setApiKey(key);
  return verdict === 'valid'
    ? { ok: true }
    : { ok: true, warning: 'Saved, but FocusGarden could not check the key right now (are you offline?).' };
}
