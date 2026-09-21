// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('continueWithMcp runs a live tool then continues the slot', async () => {
    const { useMcpStore } = await import('../app/stores/useMcpStore')
    const runtime = await import('~/lib/mcp/runtime')
    vi.spyOn(runtime, 'callMcpTool').mockResolvedValue('{"temp":22}')

    const mcpStore = useMcpStore()
    mcpStore.statusChecked = true
    mcpStore.capabilities = { stdio: false, httpProxy: false }
    mcpStore.servers = [{
      id: 's1',
      name: 'Weather',
      enabled: true,
      transport: 'http',
      url: 'http://127.0.0.1:9/mcp',
    }]
    mcpStore.tools = [{ name: 'get_weather', serverId: 's1', serverName: 'Weather' }]

    const promptStore = usePromptStore()
    promptStore.setResponses([{
      slotId: 'slot-1',
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      content: '{"name":"get_weather","arguments":{"city":"Madrid"}}',
      status: 'done',
      metrics: { latencyMs: 10, ttftMs: 5, inputTokens: 1, outputTokens: 1, costUsd: 0 },
    }])

    const { continueWithMcp } = useCompareRunner()
    await continueWithMcp({
      slotId: 'slot-1',
      toolName: 'get_weather',
      argumentsJson: '{"city":"Madrid"}',
      assistantContent: '{"name":"get_weather","arguments":{"city":"Madrid"}}',
    })

    expect(runtime.callMcpTool).toHaveBeenCalled()
    expect(promptStore.responses[0]?.mcpInspection?.resultJson).toContain('temp')
    expect(streamCompletion).toHaveBeenCalled()
    const request = streamCompletion.mock.calls[0]?.[0]
    expect(request?.userPrompt).toContain('Tool (get_weather)')
  })

  it('clearBulkResults resets bulk state', async () => {
    const { bulkResults, bulkProgress, bulkJudgeAggregates, clearBulkResults } = useCompareRunner()
    bulkResults.value = [{
      index: 0,
      variables: {},
      status: 'done',
      models: [],
    }]
    bulkProgress.value = 'Finished 1 rows'
    bulkJudgeAggregates.value = [{
      modelId: 'gpt-4o-mini',
      count: 1,
      scoredCount: 1,
      meanScore: 4,
      passRate: 1,
      meanLatencyMs: 10,
      estimatedCostUsd: 0.01,
    }]
    clearBulkResults()
    expect(bulkResults.value).toEqual([])
    expect(bulkProgress.value).toBe('')
    expect(bulkJudgeAggregates.value).toEqual([])
  })

  it('runAll scores responses when LLM judge is enabled', async () => {
    streamCompletion
      .mockImplementationOnce(async (_req, handlers) => {
        handlers.onChunk('Candidate answer')
        handlers.onDone()
      })
      .mockImplementationOnce(async (_req, handlers) => {
        handlers.onChunk(JSON.stringify({
          scores: [{ rubricId: 'r-test', score: 5, rationale: 'Great' }],
          overall: 5,
          rationale: 'Excellent',
        }))
        handlers.onDone()
      })

    const promptStore = usePromptStore()
    promptStore.judge = {
      enabled: true,
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      scale: 5,
      passThreshold: 3,
      rubrics: [{
        id: 'r-test',
        name: 'Accuracy',
        description: 'Correctness',
        enabled: true,
      }],
    }

    const { runAll } = useCompareRunner()
    await runAll()

    expect(streamCompletion).toHaveBeenCalledTimes(2)
    const judgeReq = streamCompletion.mock.calls[1]?.[0]
    expect(judgeReq?.systemPrompt).toMatch(/LLM-as-a-Judge/i)
    expect(promptStore.responses[0]?.judgeResult?.overall).toBe(5)
    expect(promptStore.responses[0]?.judgeResult?.pass).toBe(true)
  })

  it('skips judge when disabled so assertions-only paths stay intact', async () => {
    const promptStore = usePromptStore()
    promptStore.judge.enabled = false
    promptStore.assertions = [{ id: 'a1', kind: 'forbiddenSubstring', substring: 'xyz', enabled: true }]

    const { runAll } = useCompareRunner()
    await runAll()

    expect(streamCompletion).toHaveBeenCalledTimes(1)
    expect(promptStore.responses[0]?.judgeResult).toBeUndefined()
    expect(promptStore.responses[0]?.assertionResults?.[0]?.pass).toBe(true)
  })

  it('records judge failure when the evaluator call errors', async () => {
    streamCompletion
      .mockImplementationOnce(async (_req, handlers) => {
        handlers.onChunk('Candidate')
        handlers.onDone()
      })
      .mockImplementationOnce(async (_req, handlers) => {
        handlers.onError(new Error('judge down'))
      })

    const promptStore = usePromptStore()
    promptStore.judge = {
      enabled: true,
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      scale: 5,
      passThreshold: 3,
      rubrics: [{ id: 'r1', name: 'Accuracy', description: 'x', enabled: true }],
    }

    const { runAll } = useCompareRunner()
    await runAll()

    expect(promptStore.responses[0]?.judgeResult?.parseError).toMatch(/judge down/i)
    expect(promptStore.responses[0]?.judgeResult?.pass).toBe(false)
  })

  it('returns a structured error when judge has no enabled rubrics', async () => {
    streamCompletion.mockImplementationOnce(async (_req, handlers) => {
      handlers.onChunk('Candidate')
      handlers.onDone()
    })

    const promptStore = usePromptStore()
    promptStore.judge = {
      enabled: true,
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      scale: 5,
      rubrics: [{ id: 'r1', name: 'Accuracy', description: 'x', enabled: false }],
    }

    const { runAll } = useCompareRunner()
    await runAll()

    expect(streamCompletion).toHaveBeenCalledTimes(1)
    expect(promptStore.responses[0]?.judgeResult?.parseError).toMatch(/no rubrics/i)
  })

  it('skips the evaluator stream when the judge provider has no key', async () => {
    streamCompletion.mockImplementationOnce(async (_req, handlers) => {
      handlers.onChunk('Candidate')
      handlers.onDone()
    })

    const providerStore = useProviderStore()
    providerStore.setApiKey('openai', 'sk-test')
    const promptStore = usePromptStore()
    promptStore.judge = {
      enabled: true,
      provider: 'anthropic',
      modelId: 'claude-3-5-haiku-20241022',
      scale: 5,
      rubrics: [{ id: 'r1', name: 'Accuracy', description: 'x', enabled: true }],
    }

    const { runAll } = useCompareRunner()
    await runAll()

    expect(streamCompletion).toHaveBeenCalledTimes(1)
    expect(promptStore.responses[0]?.judgeResult?.parseError).toMatch(/not configured/i)
  })

  it('runBulkDataset scores each row when judge is enabled', async () => {
    streamCompletion
      .mockImplementationOnce(async (_req, handlers) => {
        handlers.onChunk('Answer A')
        handlers.onDone()
      })
      .mockImplementationOnce(async (_req, handlers) => {
        handlers.onChunk(JSON.stringify({
          scores: [{ rubricId: 'r-bulk', score: 4, rationale: 'ok' }],
          overall: 4,
          rationale: 'Fine',
        }))
        handlers.onDone()
      })

    const promptStore = usePromptStore()
    promptStore.userPrompt = 'Q {{topic}}'
    promptStore.judge = {
      enabled: true,
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      scale: 5,
      passThreshold: 3,
      rubrics: [{ id: 'r-bulk', name: 'Accuracy', description: 'x', enabled: true }],
    }

    const { runBulkDataset, bulkResults, bulkJudgeAggregates } = useCompareRunner()
    await runBulkDataset({
      rows: [{ topic: 'quantum' }],
      mapping: { topic: 'topic' },
    })

    expect(bulkResults.value[0]?.models[0]?.judgeOverall).toBe(4)
    expect(bulkResults.value[0]?.models[0]?.judgePass).toBe(true)
    expect(bulkResults.value[0]?.models[0]?.content).toBeUndefined()
    expect(bulkJudgeAggregates.value[0]?.meanScore).toBe(4)
  })
})
