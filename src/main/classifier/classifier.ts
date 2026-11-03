import Anthropic from '@anthropic-ai/sdk'
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import { MAX_SUMMARY_ITEMS, MAX_TITLE_LENGTH } from '../../shared/activity'
import {
  ClassificationError,
  type ClassificationRequest,
  type Classifier,
  type ItemLabel
} from '../../shared/classifier'
import type { Label } from '../../shared/domain'
import { badRequest, invalidOutput, toClassificationError } from './errors'
import {
  CLASSIFIER_EFFORT,
  CLASSIFIER_MAX_TOKENS,
  CLASSIFIER_MODEL,
  OUTPUT_JSON_SCHEMA,
  OutputSchema,
  SYSTEM_PROMPT
} from './prompt'

// The slice of the Anthropic client we use, so tests can inject a mock.
export interface ClassifierClient {
  messages: { create(params: MessageCreateParamsNonStreaming): Promise<Message> }
}

export interface ClassifierOptions {
  apiKey: string
  client?: ClassifierClient
}

const REQUEST_TIMEOUT_MS = 60_000

export function createClassifier({ apiKey, client }: ClassifierOptions): Classifier {
  let anthropic = client
  return async (request) => {
    validateRequest(request)
    if (request.items.length === 0) return []
    if (typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new ClassificationError('No Claude API key is set', false)
    }
    // maxRetries 0: one HTTP call per classification; the task pipeline owns retrying.
    anthropic ??= new Anthropic({ apiKey, maxRetries: 0, timeout: REQUEST_TIMEOUT_MS })

    let message: Message
    try {
      message = await anthropic.messages.create(buildParams(request))
    } catch (error) {
      throw toClassificationError(error)
    }
    return parseLabels(message, request)
  }
}

function validateRequest(request: ClassificationRequest): void {
  if (request.items.length > MAX_SUMMARY_ITEMS) {
    throw badRequest(`${request.items.length} items exceeds the limit of ${MAX_SUMMARY_ITEMS}`)
  }
  const ids = new Set(request.items.map((item) => item.id))
  if (ids.size !== request.items.length) throw badRequest('item ids are not unique')
}

function buildParams(request: ClassificationRequest): MessageCreateParamsNonStreaming {
  // Copy field by field so nothing beyond the allowed fields can reach the API.
  const payload = {
    task: { name: request.taskName, category: request.category },
    items: request.items.map((item) => ({
      id: item.id,
      app: item.app,
      title: truncateTitle(item.title),
      domain: bareHost(item.domain)
    }))
  }
  return {
    model: CLASSIFIER_MODEL,
    max_tokens: CLASSIFIER_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
    output_config: {
      effort: CLASSIFIER_EFFORT,
      format: { type: 'json_schema', schema: OUTPUT_JSON_SCHEMA }
    }
  }
}

function truncateTitle(title: string): string {
  if (title.length <= MAX_TITLE_LENGTH) return title
  const cut = title.slice(0, MAX_TITLE_LENGTH)
  // Don't leave half of a surrogate pair at the end.
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
}

// The activity reader already sends bare hosts; this guards against a full URL slipping through.
function bareHost(domain: string | null): string | null {
  if (domain === null) return null
  const trimmed = domain.trim()
  if (trimmed === '') return null
  try {
    return new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`).hostname || null
  } catch {
    return null
  }
}

function parseLabels(message: Message, request: ClassificationRequest): ItemLabel[] {
  if (message.stop_reason !== 'end_turn') {
    throw invalidOutput(`unexpected stop reason ${String(message.stop_reason)}`)
  }
  const text = message.content.find((block) => block.type === 'text')?.text
  if (text === undefined) throw invalidOutput('no text in response')

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    throw invalidOutput('not JSON', error)
  }
  const parsed = OutputSchema.safeParse(json)
  if (!parsed.success) throw invalidOutput('does not match schema', parsed.error)

  const byId = new Map<number, Label>()
  for (const { id, label } of parsed.data.labels) {
    if (byId.has(id)) throw invalidOutput('duplicate id')
    byId.set(id, label)
  }
  if (byId.size !== request.items.length) throw invalidOutput('wrong number of labels')

  return request.items.map((item) => {
    const label = byId.get(item.id)
    if (label === undefined) throw invalidOutput('missing or unknown id')
    return { id: item.id, label }
  })
}
