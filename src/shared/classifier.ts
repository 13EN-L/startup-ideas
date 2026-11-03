import type { Category, Label } from './domain'

// What is sent to Claude for one task: app name, window title, and domain only. Item ids are
// unique within a request (they are task_items row ids).
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

// What went wrong, so the UI can say why a task is waiting. 'temporary' failures are retryable;
// the others aren't.
export type ClassificationErrorKind = 'temporary' | 'no-api-key' | 'api-key-rejected' | 'failed'

export class ClassificationError extends Error {
  readonly kind: ClassificationErrorKind

  // retryable: the task should stay pending and be retried later (network, rate limit,
  // server error, invalid output). Not retryable: retrying won't help until something
  // changes, e.g. a missing or rejected API key.
  constructor(
    message: string,
    readonly retryable: boolean,
    options?: { cause?: unknown; kind?: ClassificationErrorKind }
  ) {
    super(message, options)
    this.name = 'ClassificationError'
    this.kind = options?.kind ?? (retryable ? 'temporary' : 'failed')
  }
}
