<script setup lang="ts">
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  MAX_TOKENS_MAX,
  MAX_TOKENS_MIN,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  resolveGenerationParams,
} from '~/lib/generation'

const promptStore = usePromptStore()

const temperature = computed({
  get: () => promptStore.generation.temperature ?? DEFAULT_TEMPERATURE,
  set: (value: number) => {
    const next = resolveGenerationParams({
      temperature: value,
      maxTokens: promptStore.generation.maxTokens,
    })
    promptStore.generation = {
      ...promptStore.generation,
      temperature: next.temperature,
    }
  },
})

const maxTokens = computed({
  get: () => promptStore.generation.maxTokens ?? DEFAULT_MAX_TOKENS,
  set: (value: number) => {
    const next = resolveGenerationParams({
      temperature: promptStore.generation.temperature,
      maxTokens: value,
    })
    promptStore.generation = {
      ...promptStore.generation,
      maxTokens: next.maxTokens,
    }
  },
})

function setTemperature(raw: string) {
  const value = Number(raw)
  temperature.value = Number.isFinite(value) ? value : DEFAULT_TEMPERATURE
}

function setMaxTokens(raw: string) {
  const value = Number(raw)
  maxTokens.value = Number.isFinite(value) ? value : DEFAULT_MAX_TOKENS
}
</script>

<template>
  <UiCard class="p-4">
    <h3 class="text-sm font-medium mb-3">Generation</h3>
    <div class="grid gap-3 sm:grid-cols-2">
      <div>
        <UiLabel for="gen-temperature" class="mb-1 block">Temperature</UiLabel>
        <UiInput
          id="gen-temperature"
          type="number"
          :model-value="String(temperature)"
          :min="TEMPERATURE_MIN"
          :max="TEMPERATURE_MAX"
          step="0.1"
          @update:model-value="setTemperature"
        />
      </div>
      <div>
        <UiLabel for="gen-max-tokens" class="mb-1 block">Max tokens</UiLabel>
        <UiInput
          id="gen-max-tokens"
          type="number"
          :model-value="String(maxTokens)"
          :min="MAX_TOKENS_MIN"
          :max="MAX_TOKENS_MAX"
          step="1"
          @update:model-value="setMaxTokens"
        />
      </div>
    </div>
    <p class="mt-2 text-xs text-muted-foreground">
      Applied to every selected model.
      Gemini uses <code class="text-[0.7rem]">maxOutputTokens</code>;
      Ollama uses <code class="text-[0.7rem]">num_predict</code>.
      Anthropic requires <code class="text-[0.7rem]">max_tokens</code>.
    </p>
  </UiCard>
</template>
