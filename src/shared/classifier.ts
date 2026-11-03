import type { Category, Label } from './domain'

// What is sent to Claude for one task: app name, window title, and domain only.
export interface ClassificationRequest {
  taskName: string
  category: Category
  items: { id: number; app: string; title: string; domain: string | null }[]
}

export interface ItemLabel {
  id: number
  label: Label
}

// Implemented by src/main/classifier/, the only code that calls the Claude API. Resolves with
// exactly one label per request item, or rejects with ClassificationError. It never returns
// partial results or defaults anything to on-task.
export type Classifier = (request: ClassificationRequest) => Promise<ItemLabel[]>

export class ClassificationError extends Error {
  // retryable: the task should stay pending and be retried later (network, rate limit,
  // server error, invalid output). Not retryable: retrying won't help until something
  // changes, e.g. a missing or rejected API key.
  constructor(
    message: string,
    readonly retryable: boolean,
    options?: { cause?: unknown }
  ) {
    super(message, options)
    this.name = 'ClassificationError'
  }
}
