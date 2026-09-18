// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { StreamRequest } from '~/types/llm'
import { StreamError } from '~/lib/errors'
import { logger } from '~/lib/logger'
import {
  buildProviderRequest,
  corsHint,
  extractTextChunk,
  parseProviderError,
  type StreamFormat,
} from '~/lib/streamProviders'
import { validateStreamRequest } from '~/lib/validateStreamRequest'

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: () => void
  onError: (error: StreamError) => void
  onFirstToken?: (ttftMs: number) => void
}

export function resolveStreamEndpoint(streamProxyUrl: string): string | null {
  const proxy = streamProxyUrl.trim()
  if (proxy) return proxy.replace(/\/$/, '')
  if (import.meta.dev) return '/api/stream'
  return null
}

export async function streamCompletionDirect(
  request: StreamRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const startTime = performance.now()
  let firstTokenReceived = false

  const parsed = validateStreamRequest(request)
  if (!parsed.ok) {
    const error = new StreamError({
      message: parsed.error,
      code: 'validation',
      provider: request.provider,
    })
    logger.warn('stream_direct_invalid', { error: error.toLogFields() })
    callbacks.onError(error)
    return
  }

  try {
    const providerRequest = buildProviderRequest(parsed.value)
    const response = await fetch(providerRequest.url, {
      method: 'POST',
      headers: providerRequest.headers,
      body: providerRequest.body,
      signal,
    })

    if (!response.ok) {
      const message = await parseProviderError(response)
      const error = new StreamError({
        message,
        code: 'http',
        provider: request.provider,
        status: response.status,
      })
      logger.error('stream_direct_http_error', {
        model: request.model,
        error: error.toLogFields(),
      })
      callbacks.onError(error)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      const error = new StreamError({
        message: 'No response stream available',
        code: 'no_stream',
        provider: request.provider,
      })
      callbacks.onError(error)
      return
    }

    await readStream(reader, providerRequest.format, request, {
      onChunk(text) {
        if (!firstTokenReceived) {
          firstTokenReceived = true
          callbacks.onFirstToken?.(performance.now() - startTime)
        }
        callbacks.onChunk(text)
      },
      onDone: callbacks.onDone,
    })
  }
  catch (err) {
    if (signal?.aborted) return

    if (err instanceof TypeError) {
      const error = new StreamError({
        message: `Network error: ${corsHint(request.provider)}`,
        code: 'network',
        provider: request.provider,
        cause: err,
      })
      logger.error('stream_direct_network_error', {
        model: request.model,
        error: error.toLogFields(),
      })
      callbacks.onError(error)
      return
    }

    const error = new StreamError({
      message: err instanceof Error ? err.message : 'Stream failed',
      code: 'unknown',
      provider: request.provider,
      cause: err,
    })
    logger.error('stream_direct_failed', {
      model: request.model,
      error: error.toLogFields(),
    })
    callbacks.onError(error)
  }
}

export async function streamCompletionViaProxy(
  endpoint: string,
  request: StreamRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const startTime = performance.now()
  let firstTokenReceived = false

  const parsed = validateStreamRequest(request)
  if (!parsed.ok) {
    const error = new StreamError({
      message: parsed.error,
      code: 'validation',
      provider: request.provider,
    })
    logger.warn('stream_proxy_invalid', { error: error.toLogFields() })
    callbacks.onError(error)
    return
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }))
      const error = new StreamError({
        message: (err as { message?: string }).message ?? `HTTP ${response.status}`,
        code: 'http',
        provider: request.provider,
        status: response.status,
      })
      callbacks.onError(error)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onError(new StreamError({
        message: 'No response stream available',
        code: 'no_stream',
        provider: request.provider,
      }))
      return
    }

    await readStream(reader, 'sse', request, {
      onChunk(text) {
        if (!firstTokenReceived) {
          firstTokenReceived = true
          callbacks.onFirstToken?.(performance.now() - startTime)
        }
        callbacks.onChunk(text)
      },
      onDone: callbacks.onDone,
    })
  }
  catch (err) {
    if (signal?.aborted) return
    callbacks.onError(new StreamError({
      message: err instanceof Error ? err.message : 'Stream failed',
      code: 'unknown',
      provider: request.provider,
      cause: err,
    }))
  }
}

async function readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  format: StreamFormat,
  request: StreamRequest,
  handlers: { onChunk: (text: string) => void, onDone: () => void },
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    if (format === 'ollama') {
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>
          const text = extractTextChunk(parsed, request.provider)
          if (text) handlers.onChunk(text)
        }
        catch {
          // skip malformed chunks
        }
      }
      continue
    }

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data) as Record<string, unknown>
        const text = extractTextChunk(parsed, request.provider)
        if (text) handlers.onChunk(text)
      }
      catch {
        // skip malformed SSE chunks
      }
    }
  }

  handlers.onDone()
}
