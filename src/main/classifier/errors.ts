import Anthropic from '@anthropic-ai/sdk'
import { ClassificationError } from '../../shared/classifier'

// Messages are our own: SDK and server messages can echo request content, so they stay in cause.
export function toClassificationError(error: unknown): ClassificationError {
  if (error instanceof ClassificationError) return error
  // APIConnectionError (incl. timeouts) subclasses APIError, so check it first.
  if (error instanceof Anthropic.APIConnectionError) {
    return new ClassificationError('Could not reach the Claude API', true, { cause: error })
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new ClassificationError('Claude API key was rejected (401)', false, {
      cause: error,
      kind: 'api-key-rejected'
    })
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new ClassificationError('Claude API key lacks permission (403)', false, {
      cause: error,
      kind: 'api-key-rejected'
    })
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new ClassificationError('Claude API rejected the request (400)', false, {
      cause: error
    })
  }
  if (error instanceof Anthropic.APIError) {
    const status = error.status
    if (status === undefined) {
      return new ClassificationError('Claude API request was interrupted', true, { cause: error })
    }
    const retryable = status === 408 || status === 409 || status === 429 || status >= 500
    return new ClassificationError(`Claude API error (${status})`, retryable, { cause: error })
  }
  // Unknown failures (e.g. a fetch TypeError) are most likely transient; keep the task pending.
  return new ClassificationError('Claude API call failed', true, { cause: error })
}

export function invalidOutput(reason: string, cause?: unknown): ClassificationError {
  return new ClassificationError(`Claude returned invalid labels: ${reason}`, true, { cause })
}

export function badRequest(reason: string): ClassificationError {
  return new ClassificationError(`Invalid classification request: ${reason}`, false)
}
