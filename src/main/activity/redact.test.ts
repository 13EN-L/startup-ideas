import { describe, expect, it } from 'vitest'
import { MAX_TITLE_LENGTH } from '../../shared/activity'
import { REDACTED, redactSecrets, truncateTitle } from './redact'

// Fake tokens are assembled at runtime so the full strings never appear in the source, where
// secret scanners (e.g. GitHub push protection) would flag them as real credentials.
const fake = (...parts: string[]): string => parts.join('')

describe('redactSecrets', () => {
  it.each([
    ['an OpenAI-style key', fake('sk-', 'proj-AbC123dEf456GhI789jKl012MnO345')],
    ['an Anthropic key', fake('sk-', 'ant-api03-AbCdEf123456_GhIjKl789012-MnOp')],
    ['a Stripe live key', fake('sk_', 'live_', '51HcQxYzAbCdEfGh12345678')],
    // Short enough that only the specific rule, not the long-string rule, catches them.
    ['a Stripe restricted key', fake('rk_', 'test_', 'abc123DEF456')],
    ['a GitHub token', fake('ghp_', '1234567890abcdefghijABCDEFGHIJ123456')],
    ['a GitHub server token', fake('ghs_', 'aB3dE5fG7hI9jK1lM3nO')],
    ['a Google API key with separators', fake('AIza', 'Sy-1b2C3d4E5_f6G7h8I9-j0K1l2M3n4O5p')],
    [
      'a fine-grained GitHub token',
      fake('github_', 'pat_', '11ABCDEFG0123456789_abcdefghijklmnop')
    ],
    ['a Slack bot token', fake('xox', 'b-1234567890-0987654321-AbCdEfGhIjKlMnOpQrStUvWx')],
    ['a Slack user token', fake('xox', 'p-1234567890-0987654321-AbCdEfGhIjKl')],
    ['an AWS access key id', 'AKIAIOSFODNN7EXAMPLE'],
    ['a Google API key', 'AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'],
    [
      'a JWT',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    ],
    ['a long hex string', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'],
    ['a long base64 string', 'dGhpcyBpcyBhIHNlY3JldCB0b2tlbiB2YWx1ZTEyMw=='],
    ['a Visa number', '4111111111111111'],
    ['a Visa number with spaces', '4111 1111 1111 1111'],
    ['a Mastercard number with dashes', '5555-5555-5555-4444'],
    ['an Amex number', '3782 822463 10005'],
    ['a 13-digit card number', '4222222222222'],
    ['a 19-digit card number', '4111111111111111110']
  ])('redacts %s', (_kind, secret) => {
    const result = redactSecrets(`Before ${secret} after`)
    expect(result).toBe(`Before ${REDACTED} after`)
  })

  it('redacts a Bearer token', () => {
    expect(redactSecrets('curl -H Bearer abcdefghijklmnop1234567890')).toBe(`curl -H ${REDACTED}`)
  })

  it.each([
    ['password: hunter2 - Notes', `password: ${REDACTED} - Notes`],
    ['Password = "correct horse" - Notes', `Password = ${REDACTED} - Notes`],
    ['login?user=bob&pwd=abc123', `login?user=bob&pwd=${REDACTED}`],
    ['DB_PASSWORD=s3cr3t .env', `DB_PASSWORD=${REDACTED} .env`],
    ['api_key: 12345 config.yml', `api_key: ${REDACTED} config.yml`],
    ['client secret: abc', `client secret: ${REDACTED}`],
    ['apikey=xyz', `apikey=${REDACTED}`],
    ['AccessKey: xyz', `AccessKey: ${REDACTED}`],
    ['access_key=xyz', `access_key=${REDACTED}`],
    ["secret='two words' end", `secret=${REDACTED} end`]
  ])('redacts the value in %j', (title, expected) => {
    expect(redactSecrets(title)).toBe(expected)
  })

  it('redacts a card number next to other numbers', () => {
    expect(redactSecrets('Card 4111 1111 1111 1111 2026')).toBe(`Card ${REDACTED} 2026`)
  })

  it('keeps the separators of numbers around a card number', () => {
    expect(redactSecrets('Ref 12-31 4111 1111 1111 1111 9-8 ok')).toBe(
      `Ref 12-31 ${REDACTED} 9-8 ok`
    )
  })

  it('redacts several secrets in one title', () => {
    expect(redactSecrets('AKIAIOSFODNN7EXAMPLE and password: x')).toBe(
      `${REDACTED} and password: ${REDACTED}`
    )
  })

  it.each([
    'Lecture 12: Fourier Transforms - YouTube',
    'Password manager settings - 1Password',
    'Reset your password - Example',
    'Order #48213 placed 2026-11-02',
    'Call +1 415-555-0100',
    'Tracking 4111 1111 1111 1112',
    'Commit a1b2c3d: fix build',
    'src/main/activity/summary.ts — FocusGarden',
    'how-to-build-an-electron-app-in-2026-for-beginners',
    'Secret Santa ideas',
    'Luhn-valid but 12 digits 411111111117',
    'Luhn-valid but 20 digits 41111111111111111115',
    'ReallyLongCamelCaseIdentifierNameWithoutDigits',
    'UPPERCASE_CONSTANT_NAME_WITH_DIGITS_123_ABC',
    'abcdefghijklmnopqrstuvwxyz0123456789',
    'src/Components/Settings2/Profile/EditForm.tsx',
    'Task list for the token economy essay'
  ])('leaves %j alone', (title) => {
    expect(redactSecrets(title)).toBe(title)
  })
})

describe('truncateTitle', () => {
  it('leaves short titles alone', () => {
    expect(truncateTitle('Inbox - Gmail')).toBe('Inbox - Gmail')
  })

  it('cuts long titles to the limit with an ellipsis', () => {
    const result = truncateTitle('a'.repeat(500))
    expect(result).toHaveLength(MAX_TITLE_LENGTH)
    expect(result.endsWith('…')).toBe(true)
  })

  it('keeps a title exactly at the limit', () => {
    const title = 'b'.repeat(MAX_TITLE_LENGTH)
    expect(truncateTitle(title)).toBe(title)
  })

  it.each([
    ['an emoji', '😀'],
    ['the first astral character', '\u{10000}'],
    ['the last astral character', '\u{10FFFF}']
  ])('backs off rather than split %s at the cut', (_kind, char) => {
    const result = truncateTitle('a'.repeat(MAX_TITLE_LENGTH - 2) + char + 'b'.repeat(10))
    expect(result).toBe('a'.repeat(MAX_TITLE_LENGTH - 2) + '…')
  })

  it('cuts right before a non-surrogate character above the surrogate range', () => {
    const result = truncateTitle('a'.repeat(MAX_TITLE_LENGTH - 2) + 'ｱ'.repeat(10))
    expect(result).toBe('a'.repeat(MAX_TITLE_LENGTH - 2) + 'ｱ…')
  })

  it('never splits an emoji in half', () => {
    const result = truncateTitle('a'.repeat(MAX_TITLE_LENGTH - 2) + '😀'.repeat(10))
    expect(result.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH)
    expect(result).toBe('a'.repeat(MAX_TITLE_LENGTH - 2) + '…')
  })
})
