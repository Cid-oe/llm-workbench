// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { logger } from '~/lib/logger'
import { recordStreamError, recordStreamRequest } from '~/lib/runtimeMetrics'
import { buildProviderRequest, parseProviderError } from '~/lib/streamProviders'
import { validateStreamRequest } from '~/lib/validateStreamRequest'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = validateStreamRequest(body)

  if (!parsed.ok) {
    logger.warn('stream_validation_failed', { error: parsed.error })
    throw createError({ statusCode: 400, message: parsed.error })
  }

  const request = parsed.value
  recordStreamRequest()
  logger.info('stream_proxy_start', { provider: request.provider, model: request.model })

  const providerRequest = buildProviderRequest(request)

  try {
    const upstream = await fetch(providerRequest.url, {
      method: 'POST',
      headers: providerRequest.headers,
      body: providerRequest.body,
    })

    if (!upstream.ok) {
      recordStreamError()
      const message = await parseProviderError(upstream)
      logger.error('stream_upstream_error', {
        provider: request.provider,
        model: request.model,
        status: upstream.status,
        error: message,
      })
      throw createError({
        statusCode: upstream.status,
        message,
      })
    }

    setResponseHeader(event, 'Content-Type', 'text/event-stream')
    setResponseHeader(event, 'Cache-Control', 'no-cache')
    setResponseHeader(event, 'Connection', 'keep-alive')

    if (providerRequest.format === 'ollama') {
      return transformOllamaStream(upstream)
    }

    return upstream.body
  }
  catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    recordStreamError()
    const message = err instanceof Error ? err.message : 'Upstream request failed'
    logger.error('stream_proxy_failed', { provider: request.provider, model: request.model, error: message })
    throw createError({ statusCode: 502, message })
  }
})

async function* transformOllamaStream(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        const text = parsed.message?.content ?? ''
        if (text) {
          yield `data: ${JSON.stringify({ message: { content: text } })}\n\n`
        }
        if (parsed.done) {
          yield 'data: [DONE]\n\n'
        }
      }
      catch {
        // skip
      }
    }
  }
}
