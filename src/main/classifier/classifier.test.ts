import Anthropic from '@anthropic-ai/sdk'
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import { describe, expect, it, vi } from 'vitest'
import { MAX_SUMMARY_ITEMS, MAX_TITLE_LENGTH } from '../../shared/activity'
import { ClassificationError, type ClassificationRequest } from '../../shared/classifier'
import { CLASSIFIER_MAX_TOKENS, CLASSIFIER_MODEL, createClassifier, type ClassifierClient } from '.'

const API_KEY = 'sk-ant-test-key-do-not-log'

const request: ClassificationRequest = {
  taskName: 'Study for biology exam',
  category: 'School / Study',
  items: [
    {
      id: 11,
      app: 'Google Chrome',
      title: 'Cell biology lecture - YouTube',
      domain: 'youtube.com'
    },
    { id: 12, app: 'Google Chrome', title: 'Home / X', domain: 'x.com' },
    { id: 13, app: 'Preview', title: 'chapter-4.pdf', domain: null }
  ]
}

function reply(text: string, stopReason: Message['stop_reason'] = 'end_turn'): Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: CLASSIFIER_MODEL,
    content: [{ type: 'text', text, citations: null }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 }
  } as unknown as Message
}

function labelsReply(labels: unknown): Message {
  return reply(JSON.stringify({ labels }))
}

const goodLabels = [
  { id: 13, label: 'on-task' },
  { id: 11, label: 'on-task' },
  { id: 12, label: 'off-task' }
]

function setup(
  impl: (params: MessageCreateParamsNonStreaming) => Promise<Message> = async () =>
    labelsReply(goodLabels)
): {
  classify: ReturnType<typeof createClassifier>
  create: ReturnType<typeof vi.fn<(params: MessageCreateParamsNonStreaming) => Promise<Message>>>
} {
  const create = vi.fn(impl)
  const client: ClassifierClient = { messages: { create } }
  return { classify: createClassifier({ apiKey: API_KEY, client }), create }
}

function sentParams(create: { mock: { calls: unknown[][] } }): MessageCreateParamsNonStreaming {
  expect(create.mock.calls).toHaveLength(1)
  return create.mock.calls[0][0] as MessageCreateParamsNonStreaming
}

function sentPayload(create: { mock: { calls: unknown[][] } }): unknown {
  const params = sentParams(create)
  const content = params.messages[0].content
  expect(typeof content).toBe('string')
  return JSON.parse(content as string)
}

async function expectFailure(
  promise: Promise<unknown>,
  retryable: boolean
): Promise<ClassificationError> {
  const error = await promise.then(
    (labels) => {
      throw new Error(`expected rejection, got ${JSON.stringify(labels)}`)
    },
    (e: unknown) => e
  )
  expect(error).toBeInstanceOf(ClassificationError)
  const classificationError = error as ClassificationError
  expect(classificationError.retryable).toBe(retryable)
  expect(classificationError.message).not.toContain(API_KEY)
  for (const item of request.items) expect(classificationError.message).not.toContain(item.title)
  return classificationError
}

describe('happy path', () => {
  it('returns one label per item, in request order, whatever order Claude answers in', async () => {
    const { classify } = setup()
    expect(await classify(request)).toEqual([
      { id: 11, label: 'on-task' },
      { id: 12, label: 'off-task' },
      { id: 13, label: 'on-task' }
    ])
  })

  it('makes exactly one API call', async () => {
    const { classify, create } = setup()
    await classify(request)
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe('request shape', () => {
  it('sends a strict schema that constrains each label to the two values and ids to integers', async () => {
    const { classify, create } = setup()
    await classify(request)
    const schema = sentParams(create).output_config?.format?.schema as {
      additionalProperties: boolean
      required: string[]
      properties: { labels: { items: Record<string, unknown> } }
    }
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual(['labels'])
    expect(schema.properties.labels.items).toEqual({
      type: 'object',
      properties: {
        id: { type: 'integer' },
        label: { type: 'string', enum: ['on-task', 'off-task'] }
      },
      required: ['id', 'label'],
      additionalProperties: false
    })
  })

  it('uses the model constant, a small max_tokens and structured JSON output', async () => {
    const { classify, create } = setup()
    await classify(request)
    const params = sentParams(create)
    expect(params.model).toBe(CLASSIFIER_MODEL)
    expect(params.model).toBe('claude-haiku-5-5')
    expect(params.max_tokens).toBe(CLASSIFIER_MAX_TOKENS)
    expect(params.max_tokens).toBeLessThanOrEqual(8192)
    expect(params.stream).toBeFalsy()
    expect(params.output_config?.format?.type).toBe('json_schema')
    expect(typeof params.system).toBe('string')
    expect(params.messages).toHaveLength(1)
    expect(params.messages[0].role).toBe('user')
  })

  it('sends only the task name, category, and each item id, app, title and domain', async () => {
    const { classify, create } = setup()
    await classify(request)
    expect(sentPayload(create)).toEqual({
      task: { name: 'Study for biology exam', category: 'School / Study' },
      items: request.items.map(({ id, app, title, domain }) => ({ id, app, title, domain }))
    })
  })

  it('drops extra fields a caller passes along', async () => {
    const { classify, create } = setup()
    const withExtras = {
      ...request,
      secret: 'nope',
      items: request.items.map((item) => ({ ...item, seconds: 99, url: 'https://x.com/a?b=c' }))
    }
    await classify(withExtras)
    const sent = JSON.stringify(sentParams(create).messages)
    expect(sent).not.toContain('nope')
    expect(sent).not.toContain('seconds')
    expect(sent).not.toContain('https://')
  })

  it('reduces anything that looks like a full URL to its bare host', async () => {
    const { classify, create } = setup(async () =>
      labelsReply([
        { id: 1, label: 'on-task' },
        { id: 2, label: 'on-task' },
        { id: 3, label: 'on-task' }
      ])
    )
    await classify({
      ...request,
      items: [
        {
          id: 1,
          app: 'Chrome',
          title: 't',
          domain: 'https://User:pw@Mail.Example.com:8443/inbox?token=abc'
        },
        { id: 2, app: 'Chrome', title: 't', domain: 'docs.example.com/d/123#frag' },
        { id: 3, app: 'Chrome', title: 't', domain: 'news.example.com' }
      ]
    })
    const payload = sentPayload(create) as { items: { domain: string | null }[] }
    expect(payload.items.map((item) => item.domain)).toEqual([
      'mail.example.com',
      'docs.example.com',
      'news.example.com'
    ])
    const sent = JSON.stringify(sentParams(create).messages)
    expect(sent).not.toContain('token=abc')
    expect(sent).not.toContain('pw@')
    expect(sent).not.toContain('/d/123')
  })

  it('truncates titles to MAX_TITLE_LENGTH', async () => {
    const { classify, create } = setup()
    const long = 'a'.repeat(MAX_TITLE_LENGTH + 50)
    await classify({ ...request, items: request.items.map((item) => ({ ...item, title: long })) })
    const payload = sentPayload(create) as { items: { title: string }[] }
    for (const item of payload.items) expect(item.title).toBe('a'.repeat(MAX_TITLE_LENGTH))
  })

  it('does not split a surrogate pair when truncating', async () => {
    const { classify, create } = setup()
    const title = 'a'.repeat(MAX_TITLE_LENGTH - 1) + '😀tail'
    await classify({ ...request, items: request.items.map((item) => ({ ...item, title })) })
    const payload = sentPayload(create) as { items: { title: string }[] }
    expect(payload.items[0].title).toBe('a'.repeat(MAX_TITLE_LENGTH - 1))
  })

  it('never sends the API key in the request body', async () => {
    const { classify, create } = setup()
    await classify(request)
    expect(JSON.stringify(sentParams(create))).not.toContain(API_KEY)
  })

  it('asks Claude to judge each item against this task from context, without estimating time', async () => {
    const { classify, create } = setup()
    await classify(request)
    const system = String(sentParams(create).system)
    expect(system).toMatch(/on-task/)
    expect(system).toMatch(/off-task/)
    expect(system).toMatch(/YouTube/i)
  })
})

describe('request limits', () => {
  it('returns [] for no items without calling the API', async () => {
    const { classify, create } = setup()
    expect(await classify({ ...request, items: [] })).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })

  it('accepts exactly MAX_SUMMARY_ITEMS items', async () => {
    const items = Array.from({ length: MAX_SUMMARY_ITEMS }, (_, i) => ({
      id: i + 1,
      app: 'App',
      title: `t${i}`,
      domain: null
    }))
    const { classify } = setup(async () =>
      labelsReply(items.map(({ id }) => ({ id, label: 'off-task' })))
    )
    expect(await classify({ ...request, items })).toHaveLength(MAX_SUMMARY_ITEMS)
  })

  it('rejects more than MAX_SUMMARY_ITEMS items as non-retryable, without calling the API', async () => {
    const { classify, create } = setup()
    const items = Array.from({ length: MAX_SUMMARY_ITEMS + 1 }, (_, i) => ({
      id: i + 1,
      app: 'App',
      title: 't',
      domain: null
    }))
    await expectFailure(classify({ ...request, items }), false)
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects duplicate request ids as non-retryable, without calling the API', async () => {
    const { classify, create } = setup()
    const items = [request.items[0], { ...request.items[1], id: request.items[0].id }]
    await expectFailure(classify({ ...request, items }), false)
    expect(create).not.toHaveBeenCalled()
  })
})

describe('API key', () => {
  it.each([undefined, '', '   '])(
    'rejects a missing or empty key (%j) as non-retryable',
    async (key) => {
      const create = vi.fn()
      const classify = createClassifier({ apiKey: key as string, client: { messages: { create } } })
      await expectFailure(classify(request), false)
      expect(create).not.toHaveBeenCalled()
    }
  )

  it('does not need a key when there is nothing to classify', async () => {
    const classify = createClassifier({ apiKey: '' })
    expect(await classify({ ...request, items: [] })).toEqual([])
  })

  it('builds a real client when none is injected, without making a call', () => {
    expect(typeof createClassifier({ apiKey: API_KEY })).toBe('function')
  })
})

describe('invalid output is rejected as retryable, never partially or as on-task', () => {
  const cases: [string, Message][] = [
    ['a missing id', labelsReply(goodLabels.slice(0, 2))],
    ['an unknown id', labelsReply([...goodLabels, { id: 99, label: 'on-task' }])],
    [
      'an unknown id in place of a known one',
      labelsReply([...goodLabels.slice(0, 2), { id: 99, label: 'on-task' }])
    ],
    ['a duplicate id', labelsReply([...goodLabels, { id: 11, label: 'on-task' }])],
    [
      'a duplicate id in place of a missing one',
      labelsReply([...goodLabels.slice(0, 2), { id: 13, label: 'off-task' }])
    ],
    [
      'an invalid label value',
      labelsReply([...goodLabels.slice(0, 2), { id: 12, label: 'neutral' }])
    ],
    ['a missing label', labelsReply([...goodLabels.slice(0, 2), { id: 12 }])],
    ['a string id', labelsReply([...goodLabels.slice(0, 2), { id: '12', label: 'off-task' }])],
    ['a non-integer id', labelsReply([...goodLabels.slice(0, 2), { id: 12.5, label: 'off-task' }])],
    ['labels that are not an array', reply(JSON.stringify({ labels: { 11: 'on-task' } }))],
    ['a bare array', reply(JSON.stringify(goodLabels))],
    ['an empty object', reply('{}')],
    ['null', reply('null')],
    ['non-JSON text', reply('Sure! Here are the labels: 11 on-task')],
    ['truncated JSON', reply('{"labels":[{"id":11,"label":"on-')],
    ['an empty string', reply('')],
    ['output cut off at max_tokens', reply(JSON.stringify({ labels: goodLabels }), 'max_tokens')],
    ['a refusal', reply('', 'refusal')],
    [
      'no text block',
      { ...reply(''), content: [{ type: 'thinking', thinking: '', signature: 's' }] } as Message
    ]
  ]

  it.each(cases)('%s', async (_name, message) => {
    const { classify } = setup(async () => message)
    const error = await expectFailure(classify(request), true)
    expect(error).not.toHaveProperty('labels')
  })

  it('reads the answer from the text block even after a thinking block', async () => {
    const good = labelsReply(goodLabels)
    const { classify } = setup(
      async () =>
        ({
          ...good,
          content: [{ type: 'thinking', thinking: '', signature: 's' }, ...good.content]
        }) as Message
    )
    expect(await classify(request)).toHaveLength(3)
  })
})

describe('API errors', () => {
  const headers = new Headers()
  const apiError = (status: number, type: string): Error =>
    Anthropic.APIError.generate(
      status,
      { type: 'error', error: { type, message: `server said: ${request.items[0].title}` } },
      undefined,
      headers
    )

  const cases: [string, unknown, boolean][] = [
    ['a connection error', new Anthropic.APIConnectionError({ message: 'ECONNRESET' }), true],
    ['a timeout', new Anthropic.APIConnectionTimeoutError(), true],
    ['429 rate limit', apiError(429, 'rate_limit_error'), true],
    ['500 server error', apiError(500, 'api_error'), true],
    ['503 unavailable', apiError(503, 'api_error'), true],
    ['529 overloaded', apiError(529, 'overloaded_error'), true],
    ['408 request timeout', apiError(408, 'timeout_error'), true],
    ['401 authentication', apiError(401, 'authentication_error'), false],
    ['403 permission', apiError(403, 'permission_error'), false],
    ['400 bad request', apiError(400, 'invalid_request_error'), false],
    ['402 billing', apiError(402, 'billing_error'), false],
    ['404 not found (bad model id)', apiError(404, 'not_found_error'), false],
    ['413 request too large', apiError(413, 'request_too_large'), false],
    ['an unexpected error', new TypeError('fetch failed'), true]
  ]

  it.each(cases)('%s maps to retryable=%s and keeps the cause', async (_name, cause, retryable) => {
    const { classify } = setup(async () => {
      throw cause
    })
    const error = await expectFailure(classify(request), retryable)
    expect(error.cause).toBe(cause)
  })
})

describe('privacy', () => {
  it('never logs the key, titles, domains or prompt', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {})
    )
    try {
      await setup().classify(request)
      await setup(async () => reply('not json'))
        .classify(request)
        .catch(() => {})
      await setup(async () => {
        throw new Anthropic.APIConnectionError({ message: 'down' })
      })
        .classify(request)
        .catch(() => {})
      for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })
})
