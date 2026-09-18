// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { useCompareRunner } from '../app/composables/useCompareRunner'
import { useCostCalculator } from '../app/composables/useCostCalculator'
import { usePromptStore } from '../app/stores/usePromptStore'
import { useProviderStore } from '../app/stores/useProviderStore'

const streamCompletion = vi.fn()

vi.stubGlobal('useLLMStream', () => ({ streamCompletion }))
vi.stubGlobal('useCostCalculator', useCostCalculator)

describe('useCompareRunner', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }))
    streamCompletion.mockReset()
    streamCompletion.mockImplementation(async (_req, handlers) => {
      handlers.onChunk('Hello')
      handlers.onFirstToken(12)
      handlers.onDone()
    })

    const providerStore = useProviderStore()
    providerStore.selectedModels = [
      { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
    ]
    providerStore.setApiKey('openai', 'sk-test')
  })

  it('runAll creates responses and streams completions', async () => {
    const promptStore = usePromptStore()
    promptStore.generation = { temperature: 0.25, maxTokens: 300 }
    const { runAll, canRun } = useCompareRunner()

    expect(canRun.value).toBe(true)
    await runAll()

    expect(streamCompletion).toHaveBeenCalledTimes(1)
    expect(streamCompletion.mock.calls[0]?.[0]).toMatchObject({
      temperature: 0.25,
      maxTokens: 300,
    })
    expect(promptStore.responses).toHaveLength(1)
    expect(promptStore.responses[0]?.content).toBe('Hello')
    expect(promptStore.responses[0]?.status).toBe('done')
    expect(promptStore.isRunning).toBe(false)
    expect(promptStore.history).toHaveLength(1)
  })

  it('stopAll aborts in-flight streaming', async () => {
    let release!: () => void
    streamCompletion.mockImplementation((_req, _handlers, signal?: AbortSignal) => new Promise<void>((resolve) => {
      release = resolve
      signal?.addEventListener('abort', () => resolve())
    }))

    const promptStore = usePromptStore()
    const { runAll, stopAll } = useCompareRunner()

    const running = runAll()
    // Let runAll set up responses / controllers
    await Promise.resolve()
    await Promise.resolve()

    expect(promptStore.isRunning).toBe(true)
    stopAll()
    expect(promptStore.isRunning).toBe(false)
    expect(promptStore.responses[0]?.status).toBe('cancelled')

    release()
    await running

    expect(promptStore.responses[0]?.status).toBe('cancelled')
    expect(promptStore.history).toHaveLength(0)
  })

  it('continueWithTool builds a tool follow-up prompt and streams', async () => {
    const promptStore = usePromptStore()
    promptStore.systemPrompt = 'You are helpful'
    promptStore.userPrompt = 'What is the weather?'
    promptStore.setResponses([{
      slotId: 'slot-1',
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      content: '{"name":"get_weather","arguments":{"city":"Madrid"}}',
      status: 'done',
      metrics: { latencyMs: 10, ttftMs: 5, inputTokens: 1, outputTokens: 1, costUsd: 0 },
    }])

    // Optional: registered tools do not gate continueWithTool
    promptStore.toolSignatures = [{ id: 't1', name: 'get_weather', description: 'Weather lookup' }]

    const { continueWithTool } = useCompareRunner()
    await continueWithTool({
      slotId: 'slot-1',
      toolName: 'get_weather',
      mockResultJson: '{"temp":22}',
      assistantContent: '{"name":"get_weather","arguments":{"city":"Madrid"}}',
    })

    expect(streamCompletion).toHaveBeenCalledTimes(1)
    const request = streamCompletion.mock.calls[0]?.[0]
    expect(request?.systemPrompt).toBe('You are helpful')
    expect(request?.userPrompt).toContain('Tool (get_weather)')
    expect(request?.userPrompt).toContain('"temp":22')
    expect(promptStore.responses[0]?.content).toBe('Hello')
    expect(promptStore.responses[0]?.status).toBe('done')
    expect(promptStore.isRunning).toBe(false)
  })

  it('clearBulkResults resets bulk state', () => {
    const { bulkResults, bulkProgress, clearBulkResults } = useCompareRunner()
    bulkResults.value = [{
      index: 0,
      variables: {},
      status: 'done',
      models: [],
    }]
    bulkProgress.value = 'Finished 1 rows'
    clearBulkResults()
    expect(bulkResults.value).toEqual([])
    expect(bulkProgress.value).toBe('')
  })
})
