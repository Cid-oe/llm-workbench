// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { useLLMStream } from '../app/composables/useLLMStream'
import * as streamClient from '../app/lib/streamClient'
import { useProviderStore } from '../app/stores/useProviderStore'
import type { StreamRequest } from '../app/types/llm'

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
    vi.spyOn(streamClient, 'streamCompletionDirect').mockResolvedValue(undefined)
    vi.spyOn(streamClient, 'streamCompletionViaProxy').mockResolvedValue(undefined)
    vi.spyOn(streamClient, 'resolveStreamEndpoint')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('routes through the proxy when a stream proxy URL is configured', async () => {
    const provider = useProviderStore()
    provider.streamProxyUrl = 'https://proxy.example/stream'
    vi.mocked(streamClient.resolveStreamEndpoint).mockReturnValue('https://proxy.example/stream')

    const { streamCompletion } = useLLMStream()
    await streamCompletion(request, callbacks)

    expect(streamClient.resolveStreamEndpoint).toHaveBeenCalledWith('https://proxy.example/stream')
    expect(streamClient.streamCompletionViaProxy).toHaveBeenCalledWith(
      'https://proxy.example/stream',
      request,
      callbacks,
      undefined,
    )
    expect(streamClient.streamCompletionDirect).not.toHaveBeenCalled()
  })

  it('calls providers directly when no proxy endpoint is set', async () => {
    const provider = useProviderStore()
    provider.streamProxyUrl = ''
    vi.mocked(streamClient.resolveStreamEndpoint).mockReturnValue(null)

    const { streamCompletion } = useLLMStream()
    const signal = new AbortController().signal
    await streamCompletion(request, callbacks, signal)

    expect(streamClient.streamCompletionDirect).toHaveBeenCalledWith(request, callbacks, signal)
    expect(streamClient.streamCompletionViaProxy).not.toHaveBeenCalled()
  })
})
