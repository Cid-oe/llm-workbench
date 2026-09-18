import { defineStore } from 'pinia'
import type { ProviderId } from '~/types/llm'
import {
  decryptJson,
  encryptJson,
  type ApiKeysPayload,
  type EncryptedPayload,
} from '~/lib/crypto'
import { COMBINED_PROVIDER_PERSIST_KEY, PROVIDER_PERSIST_KEYS } from '~/lib/providerPersist'
import { sessionStore } from '~/lib/sessionStore'
import { useSecurityStore } from './useSecurityStore'

export const useVaultStore = defineStore('provider-vault', {
  state: () => ({
    encryptedPayload: null as EncryptedPayload | null,
    openaiKey: '',
    anthropicKey: '',
    geminiKey: '',
    groqKey: '',
  }),

  getters: {
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
      if (provider === 'ollama' || provider === 'lmstudio') return
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
        default: return ''
      }
    },

    migrateLegacyStorage() {
      if (typeof localStorage === 'undefined') return

      try {
        const raw = localStorage.getItem(COMBINED_PROVIDER_PERSIST_KEY)
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
      }
      catch {
        // ignore corrupt legacy data
      }
    },
  },

  persist: [
    {
      key: PROVIDER_PERSIST_KEYS.vault,
      pick: ['encryptedPayload'],
    },
    {
      key: PROVIDER_PERSIST_KEYS.session,
      pick: ['openaiKey', 'anthropicKey', 'geminiKey', 'groqKey'],
      storage: sessionStore,
    },
  ],
})
