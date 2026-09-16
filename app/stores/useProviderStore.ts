import { defineStore } from 'pinia'
import type { ProviderId, ProviderModel, SelectedModel } from '~/types/llm'
import {
  decryptJson,
  encryptJson,
  type ApiKeysPayload,
  type EncryptedPayload,
} from '~/lib/crypto'
import { DEPRECATED_MODEL_MAP, migrateModelId, PROVIDER_MODELS } from '~/lib/providerModels'
import { discoverOllamaModels, staticOllamaModels } from '~/lib/ollamaModels'
import {
  assertAirGappedUrl,
  DEFAULT_LM_STUDIO_URL,
  DEFAULT_OLLAMA_URL,
  discoverLocalLlms,
  isCloudProvider,
} from '~/lib/localDiscovery'
import { sessionStore } from '~/lib/sessionStore'
import { useSecurityStore } from './useSecurityStore'

export { DEPRECATED_MODEL_MAP, PROVIDER_MODELS }

const DEFAULT_SLOTS: SelectedModel[] = [
  { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
  { slotId: 'slot-2', provider: 'ollama', modelId: 'llama3.2' },
]

const LEGACY_STORAGE_KEY = 'provider'

export const useProviderStore = defineStore('provider', {
  state: () => ({
    encryptedPayload: null as EncryptedPayload | null,
    ollamaUrl: DEFAULT_OLLAMA_URL,
    lmStudioUrl: DEFAULT_LM_STUDIO_URL,
    selectedModels: DEFAULT_SLOTS as SelectedModel[],
    openaiKey: '',
    anthropicKey: '',
    geminiKey: '',
    groqKey: '',
    streamProxyUrl: '',
    discoveredOllamaModels: null as ProviderModel[] | null,
    discoveredLmStudioModels: null as ProviderModel[] | null,
    ollamaDiscoverError: '',
    localDiscoverError: '',
    ollamaDiscovering: false,
    localDiscovering: false,
    airGapped: false,
  }),

  getters: {
    modelsByProvider(): Record<ProviderId, ProviderModel[]> {
      const base = PROVIDER_MODELS.reduce<Record<ProviderId, ProviderModel[]>>((acc, model) => {
        if (!acc[model.provider]) acc[model.provider] = []
        acc[model.provider].push(model)
        return acc
      }, {} as Record<ProviderId, ProviderModel[]>)
      base.ollama = this.discoveredOllamaModels ?? staticOllamaModels()
      base.lmstudio = this.discoveredLmStudioModels ?? []
      return base
    },

    availableProviders(): ProviderId[] {
      const all: ProviderId[] = ['openai', 'anthropic', 'gemini', 'groq', 'ollama', 'lmstudio']
      if (!this.airGapped) return all
      return all.filter(p => !isCloudProvider(p))
    },

    getModel(): (modelId: string) => ProviderModel | undefined {
      return (modelId: string) =>
        PROVIDER_MODELS.find(m => m.id === modelId)
        ?? this.discoveredOllamaModels?.find(m => m.id === modelId)
        ?? this.discoveredLmStudioModels?.find(m => m.id === modelId)
    },

    isProviderConfigured(): (provider: ProviderId) => boolean {
      return (provider: ProviderId) => {
        if (this.airGapped && isCloudProvider(provider)) return false
        switch (provider) {
          case 'openai': return !!this.openaiKey
          case 'anthropic': return !!this.anthropicKey
          case 'gemini': return !!this.geminiKey
          case 'groq': return !!this.groqKey
          case 'ollama': return !!this.ollamaUrl
          case 'lmstudio': return !!this.lmStudioUrl
          default: return false
        }
      }
    },

    hasStoredEncryptedKeys(state): boolean {
      return !!state.encryptedPayload
    },

    keysPayload(state): ApiKeysPayload {
      return {
        openaiKey: state.openaiKey,
        anthropicKey: state.anthropicKey,
        geminiKey: state.geminiKey,
        groqKey: state.groqKey,
      }
    },
  },

  actions: {
    applyKeys(payload: ApiKeysPayload) {
      this.openaiKey = payload.openaiKey
      this.anthropicKey = payload.anthropicKey
      this.geminiKey = payload.geminiKey
      this.groqKey = payload.groqKey
    },

    clearDecryptedKeys() {
      this.applyKeys({ openaiKey: '', anthropicKey: '', geminiKey: '', groqKey: '' })
    },

    async encryptAndPersistKeys() {
      const security = useSecurityStore()
      const key = security.getCryptoKey()
      if (!key) return
      this.encryptedPayload = await encryptJson(key, this.keysPayload)
    },

    async decryptKeys(cryptoKey: CryptoKey) {
      if (!this.encryptedPayload) return
      const keys = await decryptJson<ApiKeysPayload>(cryptoKey, this.encryptedPayload)
      this.applyKeys(keys)
    },

    setApiKey(provider: ProviderId, value: string) {
      if (provider === 'ollama') {
        this.ollamaUrl = value
        return
      }
      if (provider === 'lmstudio') {
        this.lmStudioUrl = value
        return
      }
      if (provider === 'openai') this.openaiKey = value
      else if (provider === 'anthropic') this.anthropicKey = value
      else if (provider === 'gemini') this.geminiKey = value
      else if (provider === 'groq') this.groqKey = value

      const security = useSecurityStore()
      if (security.getCryptoKey()) {
        void this.encryptAndPersistKeys()
      }
    },

    getApiKey(provider: ProviderId): string {
      switch (provider) {
        case 'openai': return this.openaiKey
        case 'anthropic': return this.anthropicKey
        case 'gemini': return this.geminiKey
        case 'groq': return this.groqKey
        case 'ollama': return this.ollamaUrl
        case 'lmstudio': return this.lmStudioUrl
        default: return ''
      }
    },

    setAirGapped(enabled: boolean) {
      this.airGapped = enabled
      if (!enabled) return
      this.streamProxyUrl = ''
      for (const slot of this.selectedModels) {
        if (isCloudProvider(slot.provider)) {
          const localModels = this.modelsByProvider.ollama
          const first = localModels[0]
          slot.provider = 'ollama'
          slot.modelId = first?.id ?? 'llama3.2'
        }
      }
    },

    migrateLegacyStorage() {
      if (typeof localStorage === 'undefined') return

      try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (!raw) return

        const parsed = JSON.parse(raw) as Record<string, unknown>
        const legacy = (parsed.state ?? parsed) as Record<string, string>

        if (this.encryptedPayload) return
        if (!legacy.openaiKey && !legacy.anthropicKey && !legacy.geminiKey && !legacy.groqKey) return

        this.applyKeys({
          openaiKey: legacy.openaiKey ?? '',
          anthropicKey: legacy.anthropicKey ?? '',
          geminiKey: legacy.geminiKey ?? '',
          groqKey: legacy.groqKey ?? '',
        })
        if (legacy.ollamaUrl) this.ollamaUrl = legacy.ollamaUrl
      }
      catch {
        // ignore corrupt legacy data
      }
    },

    migrateDeprecatedModels() {
      for (const slot of this.selectedModels) {
        slot.modelId = migrateModelId(slot.modelId)
      }
    },

    updateSlot(slotId: string, provider: ProviderId, modelId: string) {
      if (this.airGapped && isCloudProvider(provider)) return
      const slot = this.selectedModels.find(s => s.slotId === slotId)
      if (slot) {
        slot.provider = provider
        slot.modelId = modelId
      }
    },

    addSlot() {
      if (this.selectedModels.length >= 4) return
      const id = `slot-${Date.now()}`
      if (this.airGapped) {
        const first = this.modelsByProvider.ollama[0]
        this.selectedModels.push({
          slotId: id,
          provider: 'ollama',
          modelId: first?.id ?? 'llama3.2',
        })
        return
      }
      this.selectedModels.push({ slotId: id, provider: 'openai', modelId: 'gpt-4o-mini' })
    },

    removeSlot(slotId: string) {
      if (this.selectedModels.length <= 1) return
      this.selectedModels = this.selectedModels.filter(s => s.slotId !== slotId)
    },

    assertRequestAllowed(provider: ProviderId, url: string) {
      if (!this.airGapped) return
      if (isCloudProvider(provider)) {
        throw new Error('Air-gapped mode only allows local providers (Ollama / LM Studio)')
      }
      assertAirGappedUrl(url, true)
    },

    async refreshOllamaModels(): Promise<void> {
      this.ollamaDiscovering = true
      this.ollamaDiscoverError = ''
      try {
        const result = await discoverOllamaModels(this.ollamaUrl)
        this.discoveredOllamaModels = result.models
        this.ollamaDiscoverError = result.error ?? ''
      }
      finally {
        this.ollamaDiscovering = false
      }
    },

    async discoverLocalLlms(): Promise<void> {
      this.localDiscovering = true
      this.localDiscoverError = ''
      try {
        const result = await discoverLocalLlms({
          ollamaUrl: this.ollamaUrl,
          lmStudioUrl: this.lmStudioUrl,
        })
        const ollama = result.probes.find(p => p.backend === 'ollama')
        const lmstudio = result.probes.find(p => p.backend === 'lmstudio')
        if (ollama?.ok) {
          this.discoveredOllamaModels = ollama.models
          this.ollamaUrl = ollama.baseUrl
        }
        if (lmstudio?.ok) {
          this.discoveredLmStudioModels = lmstudio.models
          this.lmStudioUrl = lmstudio.baseUrl
        }
        const failures = result.probes.filter(p => !p.ok).map(p => p.error).filter(Boolean)
        if (!result.primary) {
          this.localDiscoverError = failures.join(' ') || 'No local LLM servers detected on :11434 or :1234.'
        }
        else if (failures.length) {
          this.localDiscoverError = failures.join(' ')
        }
      }
      finally {
        this.localDiscovering = false
      }
    },
  },

  persist: [
    {
      pick: ['encryptedPayload', 'ollamaUrl', 'lmStudioUrl', 'selectedModels', 'streamProxyUrl', 'airGapped'],
    },
    {
      key: 'provider-session',
      pick: ['openaiKey', 'anthropicKey', 'geminiKey', 'groqKey'],
      storage: sessionStore,
    },
  ],
})
