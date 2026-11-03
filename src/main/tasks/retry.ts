// Waits between classification retries. After the last one fails, the task's items are all
// labeled off-task (see docs/rewards.md). ActivityWatch failures reuse these delays, holding at
// the longest one, and never fall back.
export const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000, 600_000] as const

export const MAX_CLASSIFICATION_RETRIES = RETRY_DELAYS_MS.length

// failures is how many attempts in a row have failed (1 after the first failure).
export function retryDelayMs(failures: number): number {
  return RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length) - 1]
}
