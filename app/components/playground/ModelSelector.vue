<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { Plus, Radar, RefreshCw, Trash2 } from '@lucide/vue'
import type { ProviderId } from '~/types/llm'

const providerStore = useProviderStore()

const providerLabels: Record<ProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  groq: 'Groq',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
}

const hasOllamaSlot = computed(() =>
  providerStore.selectedModels.some(s => s.provider === 'ollama'),
)

function modelsForProvider(provider: ProviderId) {
  return providerStore.modelsByProvider[provider] ?? []
}

function onProviderChange(slotId: string, provider: ProviderId) {
  const first = modelsForProvider(provider)[0]
  if (first) providerStore.updateSlot(slotId, provider, first.id)
}

async function refreshOllama() {
  await providerStore.refreshOllamaModels()
}

async function detectLocal() {
  await providerStore.discoverLocalLlms()
}
</script>

<template>
  <UiCard class="p-4">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h3 class="text-sm font-medium">Models ({{ providerStore.selectedModels.length }}/4)</h3>
      <div class="flex flex-wrap gap-2">
        <UiButton
          variant="outline"
          size="sm"
          :disabled="providerStore.localDiscovering"
          @click="detectLocal"
        >
          <Radar class="h-4 w-4" :class="{ 'animate-spin': providerStore.localDiscovering }" />
          {{ providerStore.localDiscovering ? 'Detecting…' : 'Detect local LLMs' }}
        </UiButton>
        <UiButton
          v-if="hasOllamaSlot"
          variant="outline"
          size="sm"
          :disabled="providerStore.ollamaDiscovering"
          @click="refreshOllama"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': providerStore.ollamaDiscovering }" />
          {{ providerStore.ollamaDiscovering ? 'Refreshing…' : 'Refresh Ollama' }}
        </UiButton>
        <UiButton
          v-if="providerStore.selectedModels.length < 4"
          variant="outline"
          size="sm"
          @click="providerStore.addSlot()"
        >
          <Plus class="h-4 w-4" />
          Add
        </UiButton>
      </div>
    </div>

    <p v-if="providerStore.localDiscoverError" class="text-xs text-destructive mb-3">
      {{ providerStore.localDiscoverError }}
    </p>
    <p v-else-if="hasOllamaSlot && providerStore.ollamaDiscoverError" class="text-xs text-destructive mb-3">
      {{ providerStore.ollamaDiscoverError }}
    </p>
    <p v-if="providerStore.airGapped" class="text-xs text-muted-foreground mb-3">
      Air-gapped mode is on — only Ollama and LM Studio are selectable.
    </p>

    <div class="space-y-2">
      <div
        v-for="slot in providerStore.selectedModels"
        :key="slot.slotId"
        class="flex flex-wrap items-center gap-2"
      >
        <select
          :value="slot.provider"
          class="h-9 rounded-md border border-border bg-card px-2 text-sm"
          @change="onProviderChange(slot.slotId, ($event.target as HTMLSelectElement).value as ProviderId)"
        >
          <option
            v-for="p in providerStore.availableProviders"
            :key="p"
            :value="p"
          >
            {{ providerLabels[p] }}
          </option>
        </select>
        <select
          :value="slot.modelId"
          class="h-9 flex-1 min-w-[160px] rounded-md border border-border bg-card px-2 text-sm"
          @change="providerStore.updateSlot(slot.slotId, slot.provider, ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="model in modelsForProvider(slot.provider)"
            :key="model.id"
            :value="model.id"
          >
            {{ model.label }}
          </option>
        </select>
        <UiBadge
          :variant="providerStore.isProviderConfigured(slot.provider) ? 'success' : 'warning'"
        >
          {{ providerStore.isProviderConfigured(slot.provider) ? 'Ready' : 'No key' }}
        </UiBadge>
        <UiButton
          v-if="providerStore.selectedModels.length > 1"
          variant="ghost"
          size="sm"
          @click="providerStore.removeSlot(slot.slotId)"
        >
          <Trash2 class="h-4 w-4" />
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>
