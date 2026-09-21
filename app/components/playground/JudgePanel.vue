<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { Plus, Scale, Trash2 } from '@lucide/vue'
import { PROVIDER_MODELS } from '~/lib/providerModels'
import type { JudgeScale, ProviderId } from '~/types/llm'

const promptStore = usePromptStore()
const providerStore = useProviderStore()
const { t } = useI18n()

const providerLabels: Record<ProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  groq: 'Groq',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
}

const providers = Object.keys(providerLabels) as ProviderId[]

const modelsForJudge = computed(() =>
  PROVIDER_MODELS.filter(m => m.provider === promptStore.judge.provider),
)

const judgeConfigured = computed(() =>
  providerStore.isProviderConfigured(promptStore.judge.provider),
)

function onProviderChange(provider: ProviderId) {
  const first = PROVIDER_MODELS.find(m => m.provider === provider)
  promptStore.patchJudge({
    provider,
    modelId: first?.id ?? promptStore.judge.modelId,
  })
}

function onScaleChange(raw: string) {
  const scale = (Number(raw) === 10 ? 10 : 5) as JudgeScale
  const threshold = promptStore.judge.passThreshold
  const nextThreshold = threshold != null && threshold > scale ? scale : threshold
  promptStore.patchJudge({ scale, passThreshold: nextThreshold })
}
</script>

<template>
  <UiCard class="p-4 space-y-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 class="text-sm font-medium flex items-center gap-2">
          <Scale class="h-4 w-4" />
          {{ t('judge.title') }}
        </h3>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ t('judge.subtitle') }}
        </p>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-border"
          :checked="promptStore.judge.enabled"
          @change="promptStore.patchJudge({ enabled: ($event.target as HTMLInputElement).checked })"
        >
        {{ t('judge.enable') }}
      </label>
    </div>

    <template v-if="promptStore.judge.enabled">
      <p v-if="!judgeConfigured" class="text-xs text-destructive">
        {{ t('judge.needKey') }}
      </p>

      <div class="grid gap-2 sm:grid-cols-2">
        <div>
          <UiLabel class="mb-1.5 block">{{ t('judge.evaluatorProvider') }}</UiLabel>
          <select
            class="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            :value="promptStore.judge.provider"
            @change="onProviderChange(($event.target as HTMLSelectElement).value as ProviderId)"
          >
            <option v-for="p in providers" :key="p" :value="p">
              {{ providerLabels[p] }}
            </option>
          </select>
        </div>
        <div>
          <UiLabel class="mb-1.5 block">{{ t('judge.evaluatorModel') }}</UiLabel>
          <select
            class="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            :value="promptStore.judge.modelId"
            @change="promptStore.patchJudge({ modelId: ($event.target as HTMLSelectElement).value })"
          >
            <option v-for="m in modelsForJudge" :key="m.id" :value="m.id">
              {{ m.label }}
            </option>
          </select>
        </div>
        <div>
          <UiLabel class="mb-1.5 block">{{ t('judge.scale') }}</UiLabel>
          <select
            class="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            :value="String(promptStore.judge.scale)"
            @change="onScaleChange(($event.target as HTMLSelectElement).value)"
          >
            <option value="5">1–5</option>
            <option value="10">1–10</option>
          </select>
        </div>
        <div>
          <UiLabel class="mb-1.5 block">{{ t('judge.passThreshold') }}</UiLabel>
          <UiInput
            type="number"
            :model-value="promptStore.judge.passThreshold != null ? String(promptStore.judge.passThreshold) : ''"
            :placeholder="String(Math.ceil(promptStore.judge.scale * 0.6))"
            @update:model-value="promptStore.patchJudge({
              passThreshold: $event === '' ? undefined : Number($event),
            })"
          />
        </div>
      </div>

      <p class="text-xs text-muted-foreground">
        {{ t('judge.referenceHint') }}
      </p>

      <div class="flex items-center justify-between gap-2">
        <h4 class="text-xs font-medium">{{ t('judge.rubrics') }}</h4>
        <UiButton size="sm" variant="outline" @click="promptStore.addJudgeRubric()">
          <Plus class="h-3.5 w-3.5" />
          {{ t('judge.addRubric') }}
        </UiButton>
      </div>

      <div
        v-for="rubric in promptStore.judge.rubrics"
        :key="rubric.id"
        class="rounded-md border border-border p-3 space-y-2"
      >
        <div class="flex items-center justify-between gap-2">
          <UiInput
            class="flex-1"
            :model-value="rubric.name"
            :placeholder="t('judge.rubricName')"
            @update:model-value="promptStore.updateJudgeRubric(rubric.id, { name: String($event) })"
          />
          <UiButton variant="ghost" size="sm" @click="promptStore.removeJudgeRubric(rubric.id)">
            <Trash2 class="h-4 w-4" />
          </UiButton>
        </div>
        <textarea
          class="w-full min-h-16 rounded-md border border-border bg-card px-3 py-2 text-xs"
          :value="rubric.description"
          :placeholder="t('judge.rubricDescription')"
          @input="promptStore.updateJudgeRubric(rubric.id, {
            description: ($event.target as HTMLTextAreaElement).value,
          })"
        />
      </div>
    </template>
  </UiCard>
</template>
