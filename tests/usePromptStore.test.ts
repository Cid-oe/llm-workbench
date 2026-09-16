import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePromptStore } from '../app/stores/usePromptStore'
import type { ModelResponse } from '../app/types/llm'

const response = (patch: Partial<ModelResponse> = {}): ModelResponse => ({
  slotId: 'slot-1',
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  content: '',
  status: 'idle',
  metrics: {
    latencyMs: 0,
    ttftMs: null,
    inputTokens: 10,
    outputTokens: 0,
    costUsd: 0,
  },
  ...patch,
})

describe('usePromptStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }))
  })

  it('interpolates variables and syncs detected keys', () => {
    const store = usePromptStore()
    store.userPrompt = 'Hello {{name}}'
    store.systemPrompt = 'Speak to {{role}}'
    store.syncVariablesFromPrompts()

    expect(store.detectedVariables).toEqual(expect.arrayContaining(['name', 'role']))
    store.setVariable('name', 'Ada')
    store.setVariable('role', 'students')
    expect(store.interpolatedUserPrompt).toBe('Hello Ada')
    expect(store.interpolatedSystemPrompt).toBe('Speak to students')
  })

  it('updates responses and records history', () => {
    const store = usePromptStore()
    store.setResponses([response()])
    store.updateResponse('slot-1', { status: 'streaming', content: 'Hi' })
    expect(store.responses[0]?.content).toBe('Hi')

    store.updateResponse('slot-1', { status: 'done' })
    store.addToHistory(store.responses, [
      { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
    ])
    expect(store.history).toHaveLength(1)
    expect(store.history[0]?.responses[0]?.status).toBe('done')
  })

  it('saves and loads named prompts', () => {
    const store = usePromptStore()
    store.systemPrompt = 'sys'
    store.userPrompt = 'user'
    store.savePrompt('Demo', ['tag'])
    expect(store.savedPrompts).toHaveLength(1)

    store.systemPrompt = 'changed'
    store.loadPrompt(store.savedPrompts[0]!.id)
    expect(store.systemPrompt).toBe('sys')
    expect(store.userPrompt).toBe('user')
  })
})
