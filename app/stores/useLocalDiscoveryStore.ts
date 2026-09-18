// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { defineStore } from 'pinia'
import type { ProviderId, ProviderModel } from '~/types/llm'
import { PROVIDER_MODELS } from '~/lib/providerModels'
import { discoverOllamaModels, staticOllamaModels } from '~/lib/ollamaModels'
import {
  assertAirGappedUrl,
  DEFAULT_LM_STUDIO_URL,
  DEFAULT_OLLAMA_URL,
  discoverLocalLlms,
  isCloudProvider,
} from '~/lib/localDiscovery'
import { PROVIDER_PERSIST_KEYS } from '~/lib/providerPersist'

export const useLocalDiscoveryStore = defineStore('provider-local', {
  state: () => ({
    ollamaUrl: DEFAULT_OLLAMA_URL,
    lmStudioUrl: DEFAULT_LM_STUDIO_URL,
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
  },

  actions: {
    setEndpoint(provider: 'ollama' | 'lmstudio', value: string) {
      if (provider === 'ollama') this.ollamaUrl = value
      else this.lmStudioUrl = value
    },

    getEndpoint(provider: 'ollama' | 'lmstudio'): string {
      return provider === 'ollama' ? this.ollamaUrl : this.lmStudioUrl
    },

    setAirGapped(enabled: boolean) {
      this.airGapped = enabled
      if (enabled) this.streamProxyUrl = ''
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

  persist: {
    key: PROVIDER_PERSIST_KEYS.local,
    pick: ['ollamaUrl', 'lmStudioUrl', 'streamProxyUrl', 'airGapped'],
  },
})
