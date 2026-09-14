import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProviderStore } from '../app/stores/useProviderStore'

const memory = new Map<string, string>()

function stubLocalStorage() {
  memory.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value) },
    removeItem: (key: string) => { memory.delete(key) },
    clear: () => { memory.clear() },
  })
}

describe('useProviderStore', () => {
  beforeEach(() => {
    stubLocalStorage()
    setActivePinia(createTestingPinia({
      stubActions: false,
      createSpy: vi.fn,
    }))
  })

  it('sets API keys per provider without touching ollama URL', () => {
    const store = useProviderStore()
    store.setApiKey('openai', 'sk-new')
    store.setApiKey('anthropic', 'sk-ant-new')
    store.setApiKey('gemini', 'AIza-new')
    store.setApiKey('groq', 'gsk-new')

    expect(store.openaiKey).toBe('sk-new')
    expect(store.anthropicKey).toBe('sk-ant-new')
    expect(store.geminiKey).toBe('AIza-new')
    expect(store.groqKey).toBe('gsk-new')
    expect(store.ollamaUrl).toBe('http://localhost:11434')
    expect(store.isProviderConfigured('openai')).toBe(true)
  })

  it('stores Ollama URL via setApiKey', () => {
    const store = useProviderStore()
    store.setApiKey('ollama', 'http://127.0.0.1:11434')
    expect(store.ollamaUrl).toBe('http://127.0.0.1:11434')
    expect(store.getApiKey('ollama')).toBe('http://127.0.0.1:11434')
  })

  it('migrates plaintext keys from legacy localStorage', () => {
    const store = useProviderStore()
    memory.set('provider', JSON.stringify({
      state: {
        openaiKey: 'legacy-openai',
        anthropicKey: 'legacy-anthropic',
        geminiKey: '',
        groqKey: '',
        ollamaUrl: 'http://legacy-ollama:11434',
      },
    }))

    store.migrateLegacyStorage()

    expect(store.openaiKey).toBe('legacy-openai')
    expect(store.anthropicKey).toBe('legacy-anthropic')
    expect(store.ollamaUrl).toBe('http://legacy-ollama:11434')
  })

  it('skips legacy migration when encrypted payload already exists', () => {
    const store = useProviderStore()
    store.encryptedPayload = { v: 1, iv: 'abc', data: 'def' }
    memory.set('provider', JSON.stringify({
      state: { openaiKey: 'should-not-apply' },
    }))

    store.migrateLegacyStorage()

    expect(store.openaiKey).toBe('')
  })

  it('adds slots up to 4 and refuses a fifth', () => {
    const store = useProviderStore()
    store.$patch({
      selectedModels: [
        { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
        { slotId: 'slot-2', provider: 'ollama', modelId: 'llama3.2' },
      ],
    })
    expect(store.selectedModels).toHaveLength(2)

    store.addSlot()
    store.addSlot()
    expect(store.selectedModels).toHaveLength(4)

    store.addSlot()
    expect(store.selectedModels).toHaveLength(4)
    expect(store.selectedModels.at(-1)?.provider).toBe('openai')
  })

  it('removes slots but keeps at least one', () => {
    const store = useProviderStore()
    store.$patch({
      selectedModels: [
        { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
        { slotId: 'slot-2', provider: 'ollama', modelId: 'llama3.2' },
      ],
    })
    const firstId = store.selectedModels[0].slotId

    store.removeSlot(store.selectedModels[1].slotId)
    expect(store.selectedModels).toHaveLength(1)
    expect(store.selectedModels[0].slotId).toBe(firstId)

    store.removeSlot(firstId)
    expect(store.selectedModels).toHaveLength(1)
  })
})
