// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { defineStore, storeToRefs } from 'pinia'
import type { ProviderId, SelectedModel } from '~/types/llm'
import { isCloudProvider } from '~/lib/localDiscovery'
import { DEPRECATED_MODEL_MAP, PROVIDER_MODELS } from '~/lib/providerModels'
import {
  hasSplitProviderPersist,
  isEncryptedPayload,
  markProviderPersistSplit,
  readCombinedProviderPersist,
} from '~/lib/providerPersist'
import { useLocalDiscoveryStore } from './useLocalDiscoveryStore'
import { useModelSlotsStore } from './useModelSlotsStore'
import { useVaultStore } from './useVaultStore'

export { DEPRECATED_MODEL_MAP, PROVIDER_MODELS }

export const useProviderStore = defineStore('provider', () => {
  const vault = useVaultStore()
  const slots = useModelSlotsStore()
  const local = useLocalDiscoveryStore()

  const {
    encryptedPayload,
    openaiKey,
    anthropicKey,
    geminiKey,
    groqKey,
    hasStoredEncryptedKeys,
    keysPayload,
  } = storeToRefs(vault)

  const { selectedModels } = storeToRefs(slots)

  const {
    ollamaUrl,
    lmStudioUrl,
    streamProxyUrl,
    discoveredOllamaModels,
    discoveredLmStudioModels,
    ollamaDiscoverError,
    localDiscoverError,
    ollamaDiscovering,
    localDiscovering,
    airGapped,
    modelsByProvider,
    availableProviders,
    getModel,
  } = storeToRefs(local)

  function isProviderConfigured(provider: ProviderId): boolean {
    if (local.airGapped && isCloudProvider(provider)) return false
    switch (provider) {
      case 'openai': return !!vault.openaiKey
      case 'anthropic': return !!vault.anthropicKey
      case 'gemini': return !!vault.geminiKey
      case 'groq': return !!vault.groqKey
      case 'ollama': return !!local.ollamaUrl
      case 'lmstudio': return !!local.lmStudioUrl
      default: return false
    }
  }

  function setApiKey(provider: ProviderId, value: string) {
    if (provider === 'ollama' || provider === 'lmstudio') {
      local.setEndpoint(provider, value)
      return
    }
    vault.setApiKey(provider, value)
  }

  function getApiKey(provider: ProviderId): string {
    if (provider === 'ollama' || provider === 'lmstudio') {
      return local.getEndpoint(provider)
    }
    return vault.getApiKey(provider)
  }

  function setAirGapped(enabled: boolean) {
    local.setAirGapped(enabled)
    if (!enabled) return
    const first = local.modelsByProvider.ollama[0]
    slots.remapCloudSlots(first?.id ?? 'llama3.2')
  }

  function updateSlot(slotId: string, provider: ProviderId, modelId: string) {
    if (local.airGapped && isCloudProvider(provider)) return
    slots.updateSlot(slotId, provider, modelId)
  }

  function addSlot() {
    slots.addSlot({
      airGapped: local.airGapped,
      ollamaModelId: local.modelsByProvider.ollama[0]?.id ?? 'llama3.2',
    })
  }

  function hydrateFromCombinedPersist() {
    if (hasSplitProviderPersist()) return

    const combined = readCombinedProviderPersist()
    if (combined) {
      if (isEncryptedPayload(combined.encryptedPayload) && !vault.encryptedPayload) {
        vault.encryptedPayload = combined.encryptedPayload
      }
      if (Array.isArray(combined.selectedModels) && combined.selectedModels.length) {
        slots.selectedModels = combined.selectedModels as SelectedModel[]
      }
      if (typeof combined.ollamaUrl === 'string') local.ollamaUrl = combined.ollamaUrl
      if (typeof combined.lmStudioUrl === 'string') local.lmStudioUrl = combined.lmStudioUrl
      if (typeof combined.streamProxyUrl === 'string') local.streamProxyUrl = combined.streamProxyUrl
      if (typeof combined.airGapped === 'boolean') local.airGapped = combined.airGapped
    }

    markProviderPersistSplit()
  }

  function migrateLegacyStorage() {
    hydrateFromCombinedPersist()
    vault.migrateLegacyStorage()
  }

  function migrateDeprecatedModels() {
    slots.migrateDeprecatedModels()
  }

  return {
    encryptedPayload,
    openaiKey,
    anthropicKey,
    geminiKey,
    groqKey,
    hasStoredEncryptedKeys,
    keysPayload,
    selectedModels,
    ollamaUrl,
    lmStudioUrl,
    streamProxyUrl,
    discoveredOllamaModels,
    discoveredLmStudioModels,
    ollamaDiscoverError,
    localDiscoverError,
    ollamaDiscovering,
    localDiscovering,
    airGapped,
    modelsByProvider,
    availableProviders,
    getModel,
    isProviderConfigured,
    setApiKey,
    getApiKey,
    applyKeys: vault.applyKeys,
    clearDecryptedKeys: vault.clearDecryptedKeys,
    encryptAndPersistKeys: vault.encryptAndPersistKeys,
    decryptKeys: vault.decryptKeys,
    setAirGapped,
    updateSlot,
    addSlot,
    removeSlot: slots.removeSlot,
    assertRequestAllowed: local.assertRequestAllowed,
    refreshOllamaModels: local.refreshOllamaModels,
    discoverLocalLlms: local.discoverLocalLlms,
    migrateLegacyStorage,
    migrateDeprecatedModels,
  }
})
