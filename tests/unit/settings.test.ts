// In-app setup: Anthropic API key storage and validation (replaces the env-var-only setup)
import { describe, expect, it, vi } from 'vitest';
import type { StateStore } from '../../src/core/persistence';
import {
  checkApiKeyFormat,
  createSettingsStore,
  resolveApiKey,
  saveApiKey,
  type KeyCipher,
} from '../../src/main/settings';

const VALID_KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789';

function memoryFile(initial: string | null = null) {
  const file = {
    data: initial,
    load: vi.fn(async (): Promise<string | null> => file.data),
    save: vi.fn(async (s: string) => {
      file.data = s;
    }),
  };
  return file satisfies StateStore;
}

/** Reversible stand-in for Electron's safeStorage. */
function fakeCipher(available = true): KeyCipher {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (s) => Buffer.from([...Buffer.from(s, 'utf8')].map((b) => b ^ 0x5a)),
    decryptString: (b) => Buffer.from([...b].map((x) => x ^ 0x5a)).toString('utf8'),
  };
}

describe('checkApiKeyFormat', () => {
  it('accepts a well-formed key, ignoring surrounding whitespace', () => {
    expect(checkApiKeyFormat(VALID_KEY)).toBeNull();
    expect(checkApiKeyFormat(`  ${VALID_KEY}\n`)).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['wrong prefix', 'sk-proj-abcdefghijklmnopqrstuvwxyz'],
    ['too short', 'sk-ant-abc'],
    ['inner whitespace', 'sk-ant-api03-abc defghijklmnopqrstuvwxyz'],
  ])('rejects a key that is %s with a readable message', (_label, key) => {
    expect(checkApiKeyFormat(key)).toMatch(/\w+/);
  });
});

describe('resolveApiKey', () => {
  it('prefers a key saved in the app over the environment', () => {
    expect(resolveApiKey('sk-ant-saved', 'sk-ant-env')).toEqual({ key: 'sk-ant-saved', source: 'saved' });
  });

  it('falls back to ANTHROPIC_API_KEY', () => {
    expect(resolveApiKey(null, 'sk-ant-env')).toEqual({ key: 'sk-ant-env', source: 'environment' });
  });

  it.each([undefined, '', '   '])('reports missing when there is no key (env %j)', (env) => {
    expect(resolveApiKey(null, env)).toEqual({ key: null, source: 'missing' });
  });
});

describe('createSettingsStore', () => {
  it('returns null before a key is saved', async () => {
    await expect(createSettingsStore(memoryFile(), fakeCipher()).getApiKey()).resolves.toBeNull();
  });

  it('round-trips a key and never writes it to disk in plain text when encryption is available', async () => {
    const file = memoryFile();
    const store = createSettingsStore(file, fakeCipher());
    await store.setApiKey(VALID_KEY);

    expect(file.data).not.toContain(VALID_KEY);
    expect(JSON.parse(file.data!)).toMatchObject({ apiKey: { encoding: 'os-encrypted' } });
    await expect(createSettingsStore(file, fakeCipher()).getApiKey()).resolves.toBe(VALID_KEY);
  });

  it('still works where the OS offers no encryption (some Linux desktops)', async () => {
    const file = memoryFile();
    await createSettingsStore(file, fakeCipher(false)).setApiKey(VALID_KEY);
    expect(JSON.parse(file.data!)).toMatchObject({ apiKey: { encoding: 'plain' } });
    await expect(createSettingsStore(file, fakeCipher(false)).getApiKey()).resolves.toBe(VALID_KEY);
  });

  it('forgets the key when cleared', async () => {
    const file = memoryFile();
    const store = createSettingsStore(file, fakeCipher());
    await store.setApiKey(VALID_KEY);
    await store.clearApiKey();
    await expect(store.getApiKey()).resolves.toBeNull();
  });

  it.each([
    ['corrupt JSON', '{nope'],
    ['unknown encoding', JSON.stringify({ apiKey: { encoding: 'rot13', value: 'x' } })],
  ])('treats %s as no key instead of crashing', async (_label, raw) => {
    await expect(createSettingsStore(memoryFile(raw), fakeCipher()).getApiKey()).resolves.toBeNull();
  });

  it('treats a key that can no longer be decrypted (e.g. copied from another PC) as no key', async () => {
    const file = memoryFile();
    await createSettingsStore(file, fakeCipher()).setApiKey(VALID_KEY);
    const brokenCipher: KeyCipher = {
      ...fakeCipher(),
      decryptString: () => {
        throw new Error('Error while decrypting the ciphertext provided to safeStorage.decryptString.');
      },
    };
    await expect(createSettingsStore(file, brokenCipher).getApiKey()).resolves.toBeNull();
  });
});

describe('saveApiKey', () => {
  function setup(verdict: 'valid' | 'invalid' | 'unknown') {
    const file = memoryFile();
    const store = createSettingsStore(file, fakeCipher());
    const verify = vi.fn(async () => verdict);
    return { store, verify };
  }

  it('saves a key that Anthropic accepts, trimmed', async () => {
    const { store, verify } = setup('valid');
    await expect(saveApiKey(`  ${VALID_KEY} `, { store, verify })).resolves.toEqual({ ok: true });
    expect(verify).toHaveBeenCalledWith(VALID_KEY);
    await expect(store.getApiKey()).resolves.toBe(VALID_KEY);
  });

  it('rejects a badly formatted key without calling Anthropic', async () => {
    const { store, verify } = setup('valid');
    const result = await saveApiKey('hello', { store, verify });
    expect(result.ok).toBe(false);
    expect(verify).not.toHaveBeenCalled();
    await expect(store.getApiKey()).resolves.toBeNull();
  });

  it('rejects a key that Anthropic refuses and does not save it', async () => {
    const { store, verify } = setup('invalid');
    await expect(saveApiKey(VALID_KEY, { store, verify })).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/rejected/i),
    });
    await expect(store.getApiKey()).resolves.toBeNull();
  });

  it('saves with a warning when the key could not be checked (offline)', async () => {
    const { store, verify } = setup('unknown');
    await expect(saveApiKey(VALID_KEY, { store, verify })).resolves.toEqual({
      ok: true,
      warning: expect.stringMatching(/could not check/i),
    });
    await expect(store.getApiKey()).resolves.toBe(VALID_KEY);
  });
});
