import { defineStore } from 'pinia'
import type { ProviderId, SelectedModel } from '~/types/llm'
import { migrateModelId } from '~/lib/providerModels'
import { isCloudProvider } from '~/lib/localDiscovery'
import { PROVIDER_PERSIST_KEYS } from '~/lib/providerPersist'

const DEFAULT_SLOTS: SelectedModel[] = [
  { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
  { slotId: 'slot-2', provider: 'ollama', modelId: 'llama3.2' },
]

export const useModelSlotsStore = defineStore('provider-slots', {
  state: () => ({
    selectedModels: DEFAULT_SLOTS as SelectedModel[],
  }),

  actions: {
    updateSlot(slotId: string, provider: ProviderId, modelId: string) {
      const slot = this.selectedModels.find(s => s.slotId === slotId)
      if (slot) {
        slot.provider = provider
        slot.modelId = modelId
      }
    },

    addSlot(options?: { airGapped?: boolean, ollamaModelId?: string }) {
      if (this.selectedModels.length >= 4) return
      const id = `slot-${Date.now()}`
      if (options?.airGapped) {
        this.selectedModels.push({
          slotId: id,
          provider: 'ollama',
          modelId: options.ollamaModelId ?? 'llama3.2',
        })
        return
      }
      this.selectedModels.push({ slotId: id, provider: 'openai', modelId: 'gpt-4o-mini' })
    },

    removeSlot(slotId: string) {
      if (this.selectedModels.length <= 1) return
      this.selectedModels = this.selectedModels.filter(s => s.slotId !== slotId)
    },

    remapCloudSlots(fallbackModelId: string) {
      for (const slot of this.selectedModels) {
        if (isCloudProvider(slot.provider)) {
          slot.provider = 'ollama'
          slot.modelId = fallbackModelId
        }
      }
    },

    migrateDeprecatedModels() {
      for (const slot of this.selectedModels) {
        slot.modelId = migrateModelId(slot.modelId)
      }
    },
  },

  persist: {
    key: PROVIDER_PERSIST_KEYS.slots,
    pick: ['selectedModels'],
  },
})
