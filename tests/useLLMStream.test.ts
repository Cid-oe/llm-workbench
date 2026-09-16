import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { useLLMStream } from '../app/composables/useLLMStream'
import { useProviderStore } from '../app/stores/useProviderStore'
import type { StreamRequest } from '../app/types/llm'

const streamCompletionDirect = vi.fn()
const streamCompletionViaProxy = vi.fn()
const resolveStreamEndpoint = vi.fn()

vi.mock('../app/lib/streamClient', () => ({
  resolveStreamEndpoint: (...args: unknown[]) => resolveStreamEndpoint(...args),
  streamCompletionDirect: (...args: unknown[]) => streamCompletionDirect(...args),
  streamCompletionViaProxy: (...args: unknown[]) => streamCompletionViaProxy(...args),
}))

const request: StreamRequest = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  systemPrompt: 'Sys',
  userPrompt: 'Hi',
  apiKey: 'sk-test',
}

const callbacks = {
  onChunk: vi.fn(),
  onFirstToken: vi.fn(),
  onDone: vi.fn(),
  onError: vi.fn(),
}

describe('useLLMStream', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }))
    streamCompletionDirect.mockReset().mockResolvedValue(undefined)
    streamCompletionViaProxy.mockReset().mockResolvedValue(undefined)
    resolveStreamEndpoint.mockReset()
  })

  it('routes through the proxy when a stream proxy URL is configured', async () => {
    const provider = useProviderStore()
    provider.streamProxyUrl = 'https://proxy.example/stream'
    resolveStreamEndpoint.mockReturnValue('https://proxy.example/stream')

    const { streamCompletion } = useLLMStream()
    await streamCompletion(request, callbacks)

    expect(resolveStreamEndpoint).toHaveBeenCalledWith('https://proxy.example/stream')
    expect(streamCompletionViaProxy).toHaveBeenCalledWith(
      'https://proxy.example/stream',
      request,
      callbacks,
      undefined,
    )
    expect(streamCompletionDirect).not.toHaveBeenCalled()
  })

  it('calls providers directly when no proxy endpoint is set', async () => {
    const provider = useProviderStore()
    provider.streamProxyUrl = ''
    resolveStreamEndpoint.mockReturnValue(null)

    const { streamCompletion } = useLLMStream()
    const signal = new AbortController().signal
    await streamCompletion(request, callbacks, signal)

    expect(streamCompletionDirect).toHaveBeenCalledWith(request, callbacks, signal)
    expect(streamCompletionViaProxy).not.toHaveBeenCalled()
  })
})
