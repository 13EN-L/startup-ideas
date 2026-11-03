import { MAX_TITLE_LENGTH } from '../../shared/activity'

export const REDACTED = '[redacted]'

// `password: x`, `pwd=x`, `API_KEY=x`: keep the label, drop the value (quoted or one word).
const LABELED_SECRET =
  /(?<![A-Za-z])(password|passwd|passphrase|passcode|pwd|secret|token|api[_ -]?key|access[_ -]?key)(\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi

const TOKENS = [
  /\bsk-[A-Za-z0-9_-]{16,}/g, // OpenAI, Anthropic
  /\b[spr]k_(?:live|test)_[A-Za-z0-9]{10,}/g, // Stripe
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g, // GitHub
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, // Slack
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, // AWS access key id
  /\bAIza[A-Za-z0-9_-]{35}/g, // Google API key
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, // JWT
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi,
  /\b[0-9a-f]{32,}\b/gi // hex keys and hashes
]

// Base64-ish runs. To spare slugs, paths and long words, a run counts only if it mixes upper
// and lower case and digits and has a long unbroken alphanumeric stretch, as random keys do.
const LONG_RUN = /[A-Za-z0-9+/_=-]{32,}/g

function looksRandom(run: string): boolean {
  return /[a-z]/.test(run) && /[A-Z]/.test(run) && /\d/.test(run) && /[A-Za-z0-9]{20,}/.test(run)
}

function luhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

// A run of digit groups separated by single spaces or dashes. Cards are 13 to 19 digits, so we
// look for the longest Luhn-valid stretch of whole groups, which also catches a card number
// sitting next to a year or an order number.
const DIGIT_RUN = /\d+(?:[ -]\d+)*/g

function redactCards(run: string): string {
  const groups = run.split(/[ -]/)
  const seps = run.match(/[ -]/g) ?? []
  const join = (from: number, to: number): string =>
    groups
      .slice(from, to)
      .map((g, k) => (k === 0 ? g : seps[from + k - 1] + g))
      .join('')

  for (let i = 0; i < groups.length; i++) {
    for (let j = groups.length; j > i; j--) {
      const digits = groups.slice(i, j).join('')
      if (digits.length < 13 || digits.length > 19 || !luhn(digits)) continue
      const before = i > 0 ? join(0, i) + seps[i - 1] : ''
      const after = j < groups.length ? seps[j - 1] + redactCards(join(j, groups.length)) : ''
      return before + REDACTED + after
    }
  }
  return run
}

// Replaces anything that looks like a password, API key, token or card number.
export function redactSecrets(text: string): string {
  let result = text.replace(LABELED_SECRET, (_m, label, sep) => `${label}${sep}${REDACTED}`)
  for (const pattern of TOKENS) result = result.replace(pattern, REDACTED)
  result = result.replace(LONG_RUN, (run) => (looksRandom(run) ? REDACTED : run))
  return result.replace(DIGIT_RUN, redactCards)
}

// Cuts to at most `max` UTF-16 units, ending in an ellipsis, without splitting a surrogate pair.
export function truncateTitle(title: string, max = MAX_TITLE_LENGTH): string {
  if (title.length <= max) return title
  let cut = max - 1
  const code = title.charCodeAt(cut - 1)
  if (code >= 0xd800 && code <= 0xdbff) cut--
  return title.slice(0, cut) + '…'
}
