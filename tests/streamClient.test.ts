import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resolveStreamEndpoint,
  streamCompletionDirect,
  streamCompletionViaProxy,
} from '../app/lib/streamClient'
import type { StreamRequest } from '../app/types/llm'

function textStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function collectCallbacks() {
  const collect = {
    chunks: [] as string[],
    done: false,
    error: null as string | null,
    ttft: null as number | null,
    onChunk: (text: string) => { collect.chunks.push(text) },
    onDone: () => { collect.done = true },
    onError: (error: string) => { collect.error = error },
    onFirstToken: (ttftMs: number) => { collect.ttft = ttftMs },
  }
  return collect
}

const openaiRequest: StreamRequest = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  systemPrompt: 'Sys',
  userPrompt: 'Hi',
  apiKey: 'sk-test',
}

const ollamaRequest: StreamRequest = {
  provider: 'ollama',
  model: 'llama3.2',
  systemPrompt: 'Sys',
  userPrompt: 'Hi',
  ollamaUrl: 'http://localhost:11434',
}

describe('streamClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('resolves a custom proxy URL and the local Nitro endpoint in dev', () => {
    expect(resolveStreamEndpoint(' https://proxy.example/stream/ ')).toBe('https://proxy.example/stream')
    expect(resolveStreamEndpoint('')).toBe(import.meta.dev ? '/api/stream' : null)
  })

  it('parses SSE chunks and calls onChunk/onDone/onFirstToken', async () => {
    const callbacks = collectCallbacks()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      textStream([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n',
        'data: [DONE]\n',
      ]),
      { status: 200 },
    )))

    await streamCompletionDirect(openaiRequest, callbacks)

    expect(callbacks.chunks.join('')).toBe('Hello world')
    expect(callbacks.done).toBe(true)
    expect(callbacks.error).toBeNull()
    expect(callbacks.ttft).toEqual(expect.any(Number))
  })

  it('parses Ollama NDJSON chunks', async () => {
    const callbacks = collectCallbacks()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      textStream([
        '{"message":{"content":"Hi"}}\n',
        '{"message":{"content":" there"},"done":true}\n',
      ]),
      { status: 200 },
    )))

    await streamCompletionDirect(ollamaRequest, callbacks)

    expect(callbacks.chunks.join('')).toBe('Hi there')
    expect(callbacks.done).toBe(true)
    expect(callbacks.error).toBeNull()
  })

  it('forwards HTTP errors to onError', async () => {
    const callbacks = collectCallbacks()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { message: 'quota exceeded' } }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )))

    await streamCompletionDirect(openaiRequest, callbacks)

    expect(callbacks.error).toBe('quota exceeded')
    expect(callbacks.done).toBe(false)
    expect(callbacks.chunks).toEqual([])
  })

  it('parses SSE through the proxy helper', async () => {
    const callbacks = collectCallbacks()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      textStream([
        'data: {"choices":[{"delta":{"content":"Proxy"}}]}\n',
        'data: [DONE]\n',
      ]),
      { status: 200 },
    )))

    await streamCompletionViaProxy('/api/stream', openaiRequest, callbacks)

    expect(callbacks.chunks.join('')).toBe('Proxy')
    expect(callbacks.done).toBe(true)
    expect(callbacks.error).toBeNull()
  })

  it('rejects invalid requests before fetching', async () => {
    const callbacks = collectCallbacks()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await streamCompletionDirect({
      ...openaiRequest,
      provider: 'unknown' as StreamRequest['provider'],
    }, callbacks)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(callbacks.error).toMatch(/provider/i)
  })
})
