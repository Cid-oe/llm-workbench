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

  it('keeps revisions and round-trips a .prompt file without secrets', () => {
    const store = usePromptStore()
    store.systemPrompt = 'sys v1'
    store.userPrompt = 'user v1'
    store.savePrompt('Demo')
    store.systemPrompt = 'sys v2'
    store.userPrompt = 'user v2'
    store.savePrompt('Demo')
    expect(store.savedPrompts[0]?.version).toBe(2)
    expect(store.savedPrompts[0]?.revisions).toHaveLength(1)
    expect(store.promptSnapshots.some(s => s.source === 'revision')).toBe(true)

    store.generation = { temperature: 0.2 }
    store.variables = { topic: 'x' }
    const markdown = store.exportPromptMarkdown({ name: 'Demo', model: 'gpt-4o', provider: 'openai' })
    expect(markdown).toContain('temperature: 0.2')
    expect(markdown).not.toContain('apiKey')

    store.systemPrompt = 'other'
    store.importPromptMarkdown(`---
model: gpt-4o
apiKey: sk-secret
temperature: 0.5
variables:
  topic: imported
---
## System
imported sys
## User
imported user
`)
    expect(store.systemPrompt).toBe('imported sys')
    expect(store.userPrompt).toBe('imported user')
    expect(store.generation.temperature).toBe(0.5)
    expect(store.variables.topic).toBe('imported')
    expect(JSON.stringify(store.$state)).not.toContain('sk-secret')
  })

  it('exports and imports JSON backups without secret variables', () => {
    const store = usePromptStore()
    store.variables = { topic: 'x', api_key: 'sk-live' }
    store.addToHistory([response({ content: 'out', status: 'done' })], [
      { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
    ])
    store.savePrompt('Pack')

    const json = store.exportBackupJson()
    expect(json).not.toContain('sk-live')

    store.clearHistory()
    store.savedPrompts = []
    const counts = store.importBackupJson(json, 'replace')
    expect(counts.history).toBe(1)
    expect(counts.savedPrompts).toBe(1)
    expect(store.history[0]?.variables).toEqual({ topic: 'x' })
    expect(store.savedPrompts[0]?.name).toBe('Pack')
  })

  it('loads from history, clears history, and deletes saved prompts', () => {
    const store = usePromptStore()
    store.systemPrompt = 'run-sys'
    store.userPrompt = 'run-user'
    store.variables = { topic: 'alpha' }
    store.addToHistory([response({ content: 'done-out', status: 'done' })], [
      { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
    ])
    const historyId = store.history[0]!.id

    store.systemPrompt = 'changed'
    store.userPrompt = 'changed'
    store.variables = {}
    store.responses = []

    store.loadFromHistory(historyId)
    expect(store.systemPrompt).toBe('run-sys')
    expect(store.userPrompt).toBe('run-user')
    expect(store.variables.topic).toBe('alpha')
    expect(store.responses[0]?.content).toBe('done-out')

    store.savePrompt('Keep')
    store.savePrompt('Drop')
    expect(store.savedPrompts).toHaveLength(2)
    store.deleteSavedPrompt(store.savedPrompts.find(p => p.name === 'Drop')!.id)
    expect(store.savedPrompts.map(p => p.name)).toEqual(['Keep'])

    store.clearHistory()
    expect(store.history).toHaveLength(0)
  })

  it('bumps saved prompt version and caps history at 100', () => {
    const store = usePromptStore()
    store.savePrompt('Demo')
    expect(store.savedPrompts[0]?.version).toBe(1)
    store.systemPrompt = 'v2'
    store.savePrompt('Demo')
    expect(store.savedPrompts[0]?.version).toBe(2)
    expect(store.savedPrompts[0]?.revisions).toHaveLength(1)

    store.history = []
    for (let i = 0; i < 105; i++) {
      store.addToHistory([response({ content: `c-${i}`, status: 'done' })], [
        { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
      ])
    }
    expect(store.history).toHaveLength(100)
  })
})
