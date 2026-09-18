import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProviderStore } from '../app/stores/useProviderStore'
import { useSecurityStore } from '../app/stores/useSecurityStore'

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
    expect(store.getApiKey('openai')).toBe('sk-new')
    expect(store.getApiKey('anthropic')).toBe('sk-ant-new')
    expect(store.getApiKey('gemini')).toBe('AIza-new')
    expect(store.getApiKey('groq')).toBe('gsk-new')
    expect(store.ollamaUrl).toBe('http://localhost:11434')
    expect(store.isProviderConfigured('openai')).toBe(true)
    expect(store.isProviderConfigured('anthropic')).toBe(true)
    expect(store.isProviderConfigured('gemini')).toBe(true)
    expect(store.isProviderConfigured('groq')).toBe(true)
  })

  it('stores Ollama URL via setApiKey', () => {
    const store = useProviderStore()
    store.setApiKey('ollama', 'http://127.0.0.1:11434')
    expect(store.ollamaUrl).toBe('http://127.0.0.1:11434')
    expect(store.getApiKey('ollama')).toBe('http://127.0.0.1:11434')
  })

  it('stores LM Studio URL via setApiKey', () => {
    const store = useProviderStore()
    store.setApiKey('lmstudio', 'http://127.0.0.1:1234')
    expect(store.lmStudioUrl).toBe('http://127.0.0.1:1234')
    expect(store.getApiKey('lmstudio')).toBe('http://127.0.0.1:1234')
    expect(store.isProviderConfigured('lmstudio')).toBe(true)
  })

  it('airGapped filters availableProviders and blocks cloud configuration', () => {
    const store = useProviderStore()
    store.setApiKey('openai', 'sk-live')
    store.setAirGapped(true)

    expect(store.availableProviders).toEqual(['ollama', 'lmstudio'])
    expect(store.isProviderConfigured('openai')).toBe(false)
    expect(store.isProviderConfigured('anthropic')).toBe(false)
    expect(store.isProviderConfigured('ollama')).toBe(true)
    expect(store.selectedModels.every(s => s.provider === 'ollama' || s.provider === 'lmstudio')).toBe(true)
    expect(store.streamProxyUrl).toBe('')

    store.setAirGapped(false)
    expect(store.airGapped).toBe(false)
    expect(store.availableProviders).toContain('openai')
  })

  it('updateSlot refuses cloud providers when air-gapped', () => {
    const store = useProviderStore()
    store.setAirGapped(true)
    const slotId = store.selectedModels[0]!.slotId
    store.updateSlot(slotId, 'openai', 'gpt-4o-mini')
    expect(store.selectedModels[0]!.provider).not.toBe('openai')
  })

  it('updateSlot writes provider and model when the slot exists', () => {
    const store = useProviderStore()
    const slotId = store.selectedModels[0]!.slotId
    store.updateSlot(slotId, 'anthropic', 'claude-3-5-haiku-20241022')
    expect(store.selectedModels[0]).toMatchObject({
      provider: 'anthropic',
      modelId: 'claude-3-5-haiku-20241022',
    })
    store.updateSlot('missing-slot', 'openai', 'gpt-4o')
    expect(store.selectedModels[0]!.provider).toBe('anthropic')
  })

  it('encryptAndPersistKeys and decryptKeys round-trip with unlocked security store', async () => {
    const store = useProviderStore()
    const security = useSecurityStore()
    store.applyKeys({
      openaiKey: 'sk-enc',
      anthropicKey: 'sk-ant-enc',
      geminiKey: '',
      groqKey: '',
    })
    await security.setupMasterPassword('correct-horse')
    await store.encryptAndPersistKeys()

    expect(store.encryptedPayload).not.toBeNull()
    expect(store.hasStoredEncryptedKeys).toBe(true)

    store.clearDecryptedKeys()
    expect(store.openaiKey).toBe('')

    await store.decryptKeys(security.getCryptoKey()!)
    expect(store.openaiKey).toBe('sk-enc')
    expect(store.anthropicKey).toBe('sk-ant-enc')
  })

  it('setApiKey persists encrypted payload when vault is unlocked', async () => {
    const store = useProviderStore()
    const security = useSecurityStore()
    await security.setupMasterPassword('correct-horse')
    store.encryptedPayload = null

    store.setApiKey('openai', 'sk-after-unlock')
    await vi.waitFor(() => {
      expect(store.encryptedPayload).not.toBeNull()
    })

    const cryptoKey = security.getCryptoKey()!
    store.clearDecryptedKeys()
    await store.decryptKeys(cryptoKey)
    expect(store.openaiKey).toBe('sk-after-unlock')
  })

  it('discoverLocalLlms populates Ollama and LM Studio models', async () => {
    const store = useProviderStore()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes(':11434')) {
        return new Response(JSON.stringify({ models: [{ name: 'phi3:latest' }] }), { status: 200 })
      }
      if (url.includes(':1234')) {
        return new Response(JSON.stringify({ data: [{ id: 'local-mistral' }] }), { status: 200 })
      }
      return new Response('no', { status: 404 })
    }))

    await store.discoverLocalLlms()

    expect(store.discoveredOllamaModels?.map(m => m.id)).toEqual(['phi3:latest'])
    expect(store.discoveredLmStudioModels?.map(m => m.id)).toEqual(['local-mistral'])
    expect(store.getModel('local-mistral')?.provider).toBe('lmstudio')
    expect(store.localDiscoverError).toBe('')
    expect(store.localDiscovering).toBe(false)
  })

  it('discoverLocalLlms surfaces an error when nothing is listening', async () => {
    const store = useProviderStore()
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))

    await store.discoverLocalLlms()

    expect(store.localDiscoverError).toMatch(/local LLM|Could not reach|Ollama/i)
    expect(store.localDiscovering).toBe(false)
  })

  it('discoverLocalLlms keeps a partial error when only one backend answers', async () => {
    const store = useProviderStore()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes(':11434')) {
        return new Response(JSON.stringify({ models: [{ name: 'phi3:latest' }] }), { status: 200 })
      }
      throw new TypeError('Failed to fetch')
    }))

    await store.discoverLocalLlms()

    expect(store.discoveredOllamaModels?.map(m => m.id)).toEqual(['phi3:latest'])
    expect(store.discoveredLmStudioModels).toBeNull()
    expect(store.localDiscoverError).toMatch(/LM Studio|Could not reach|Failed to fetch/i)
    expect(store.localDiscovering).toBe(false)
  })

  it('assertRequestAllowed throws for cloud providers when air-gapped', () => {
    const store = useProviderStore()
    store.setAirGapped(true)
    expect(() => store.assertRequestAllowed('openai', 'https://api.openai.com')).toThrow(/Air-gapped/)
    expect(() => store.assertRequestAllowed('ollama', 'http://localhost:11434')).not.toThrow()
  })

  it('addSlot prefers ollama when air-gapped', () => {
    const store = useProviderStore()
    store.setAirGapped(true)
    store.selectedModels = [{ slotId: 'slot-1', provider: 'ollama', modelId: 'llama3.2' }]
    store.addSlot()
    expect(store.selectedModels.at(-1)?.provider).toBe('ollama')
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
    store.selectedModels = [
      { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
      { slotId: 'slot-2', provider: 'ollama', modelId: 'llama3.2' },
    ]
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
    store.selectedModels = [
      { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
      { slotId: 'slot-2', provider: 'ollama', modelId: 'llama3.2' },
    ]
    const firstId = store.selectedModels[0].slotId

    store.removeSlot(store.selectedModels[1].slotId)
    expect(store.selectedModels).toHaveLength(1)
    expect(store.selectedModels[0].slotId).toBe(firstId)

    store.removeSlot(firstId)
    expect(store.selectedModels).toHaveLength(1)
  })

  it('refreshOllamaModels populates discovered models on success', async () => {
    const store = useProviderStore()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'phi3:latest' }] }),
    }))

    await store.refreshOllamaModels()

    expect(store.discoveredOllamaModels?.map(m => m.id)).toEqual(['phi3:latest'])
    expect(store.modelsByProvider.ollama.map(m => m.id)).toEqual(['phi3:latest'])
    expect(store.ollamaDiscoverError).toBe('')
    expect(store.getModel('phi3:latest')?.provider).toBe('ollama')
  })

  it('refreshOllamaModels keeps static fallback and surfaces an error when fetch fails', async () => {
    const store = useProviderStore()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await store.refreshOllamaModels()

    expect(store.modelsByProvider.ollama.map(m => m.id)).toEqual(['llama3.2', 'mistral'])
    expect(store.ollamaDiscoverError).toMatch(/could not reach ollama/i)
  })

  it('migrateDeprecatedModels remaps retired model IDs on slots', () => {
    const store = useProviderStore()
    store.selectedModels = [
      { slotId: 'slot-1', provider: 'gemini', modelId: 'gemini-1.5-flash' },
      { slotId: 'slot-2', provider: 'ollama', modelId: 'llama3.2' },
    ]

    store.migrateDeprecatedModels()

    expect(store.selectedModels[0]?.modelId).toBe('gemini-3.6-flash')
    expect(store.selectedModels[1]?.modelId).toBe('llama3.2')
  })

  it('hydrates vault, slots, and local discovery from the combined provider persist key', () => {
    const store = useProviderStore()
    memory.set('provider', JSON.stringify({
      encryptedPayload: { v: 1, iv: 'iv', data: 'cipher' },
      ollamaUrl: 'http://127.0.0.1:11434',
      lmStudioUrl: 'http://127.0.0.1:1234',
      streamProxyUrl: 'https://proxy.example/stream',
      airGapped: true,
      selectedModels: [
        { slotId: 'slot-kept', provider: 'ollama', modelId: 'phi3:latest' },
      ],
    }))

    store.migrateLegacyStorage()

    expect(store.encryptedPayload).toEqual({ v: 1, iv: 'iv', data: 'cipher' })
    expect(store.ollamaUrl).toBe('http://127.0.0.1:11434')
    expect(store.lmStudioUrl).toBe('http://127.0.0.1:1234')
    expect(store.streamProxyUrl).toBe('https://proxy.example/stream')
    expect(store.airGapped).toBe(true)
    expect(store.selectedModels).toEqual([
      { slotId: 'slot-kept', provider: 'ollama', modelId: 'phi3:latest' },
    ])
    expect(memory.get('provider-persist-v2')).toBe('1')
  })

  it('does not re-copy combined persist after the split flag is set', () => {
    const store = useProviderStore()
    memory.set('provider-persist-v2', '1')
    memory.set('provider', JSON.stringify({
      ollamaUrl: 'http://should-not-apply:11434',
      selectedModels: [
        { slotId: 'ignored', provider: 'openai', modelId: 'gpt-4o' },
      ],
    }))

    store.migrateLegacyStorage()

    expect(store.ollamaUrl).toBe('http://localhost:11434')
    expect(store.selectedModels.map(s => s.slotId)).toEqual(['slot-1', 'slot-2'])
  })

  it('returns cloud API keys and treats unknown local lookups as empty on the vault path', () => {
    const store = useProviderStore()
    store.setApiKey('openai', 'sk-cloud')
    expect(store.getApiKey('openai')).toBe('sk-cloud')
    expect(store.getApiKey('anthropic')).toBe('')
    expect(store.isProviderConfigured('gemini')).toBe(false)
  })
})
