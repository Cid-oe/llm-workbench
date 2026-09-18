// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { defineStore } from 'pinia'
import type { ProviderId } from '~/types/llm'
import type { ApiKeysPayload, EncryptedPayload } from '~/lib/crypto'
import { PROVIDER_PERSIST_KEYS } from '~/lib/providerPersist'
import {
  decryptKeys,
  encryptKeys,
  localStore,
  readLegacyPlaintextKeys,
  sessionStore,
} from '~/lib/vaultService'
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
      this.encryptedPayload = await encryptKeys(key, this.keysPayload)
    },

    async decryptKeys(cryptoKey: CryptoKey) {
      if (!this.encryptedPayload) return
      this.applyKeys(await decryptKeys(cryptoKey, this.encryptedPayload))
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
      if (this.encryptedPayload) return
      const legacy = readLegacyPlaintextKeys()
      if (!legacy) return
      this.applyKeys(legacy)
    },
  },

  persist: [
    {
      key: PROVIDER_PERSIST_KEYS.vault,
      pick: ['encryptedPayload'],
      storage: localStore,
    },
    {
      key: PROVIDER_PERSIST_KEYS.session,
      pick: ['openaiKey', 'anthropicKey', 'geminiKey', 'groqKey'],
      storage: sessionStore,
    },
  ],
})
