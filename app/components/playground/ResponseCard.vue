<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { Check, Copy, Loader2 } from '@lucide/vue'
import type { ModelResponse } from '~/types/llm'
import { PROVIDER_MODELS } from '~/stores/useProviderStore'
import { detectToolCalls, matchRegisteredTool } from '~/lib/toolCall'

const props = defineProps<{ response: ModelResponse }>()
const emit = defineEmits<{
  continueWithTool: [payload: { slotId: string, toolName: string, mockResultJson: string, assistantContent: string }]
}>()

const promptStore = usePromptStore()
const { formatCost, formatLatency } = useCostCalculator()

const model = computed(() => PROVIDER_MODELS.find(m => m.id === props.response.modelId))
const copied = ref(false)
const mockJson = ref('{\n  "ok": true\n}')
const selectedTool = ref('')

const detectedCalls = computed(() =>
  props.response.status === 'done' ? detectToolCalls(props.response.content) : [],
)

const matchedCalls = computed(() =>
  detectedCalls.value.filter(call => matchRegisteredTool(call, promptStore.toolSignatures)),
)

watch(matchedCalls, (calls) => {
  if (calls[0] && !selectedTool.value) {
    selectedTool.value = calls[0].name
    mockJson.value = '{\n  "ok": true,\n  "result": "mock"\n}'
  }
}, { immediate: true })

async function copyResponse() {
  await navigator.clipboard.writeText(props.response.content)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function continueTurn() {
  const name = selectedTool.value || matchedCalls.value[0]?.name
  if (!name) return
  emit('continueWithTool', {
    slotId: props.response.slotId,
    toolName: name,
    mockResultJson: mockJson.value,
    assistantContent: props.response.content,
  })
}

const statusVariant = computed(() => {
  switch (props.response.status) {
    case 'streaming': return 'warning' as const
    case 'done': return 'success' as const
    case 'error': return 'error' as const
    case 'cancelled': return 'warning' as const
    default: return 'secondary' as const
  }
})
</script>

<template>
  <UiCard class="flex flex-col h-full min-h-[280px] overflow-hidden">
    <div class="flex items-center justify-between border-b border-border px-4 py-3">
      <div class="flex items-center gap-2 min-w-0">
        <span class="font-medium text-sm truncate">{{ model?.label ?? response.modelId }}</span>
        <UiBadge :variant="statusVariant">{{ response.status }}</UiBadge>
        <UiBadge
          v-if="response.assertionResults?.length"
          :variant="response.assertionResults.every(r => r.pass) ? 'success' : 'error'"
        >
          {{ response.assertionResults.every(r => r.pass) ? 'PASS' : 'FAIL' }}
        </UiBadge>
      </div>
      <UiButton variant="ghost" size="sm" :disabled="!response.content" @click="copyResponse">
        <Check v-if="copied" class="h-4 w-4 text-emerald-400" />
        <Copy v-else class="h-4 w-4" />
      </UiButton>
    </div>

    <div class="flex flex-wrap gap-2 px-4 py-2 border-b border-border bg-muted/30">
      <UiBadge variant="secondary">{{ formatLatency(response.metrics.latencyMs) }}</UiBadge>
      <UiBadge v-if="response.metrics.ttftMs" variant="secondary">
        TTFT {{ formatLatency(response.metrics.ttftMs) }}
      </UiBadge>
      <UiBadge variant="secondary">In {{ response.metrics.inputTokens }}</UiBadge>
      <UiBadge variant="secondary">Out {{ response.metrics.outputTokens }}</UiBadge>
      <UiBadge variant="secondary">{{ formatCost(response.metrics.costUsd) }}</UiBadge>
    </div>

    <div class="flex-1 overflow-auto p-4 space-y-3">
      <div v-if="response.status === 'streaming' && !response.content" class="flex items-center gap-2 text-muted-foreground">
        <Loader2 class="h-4 w-4 animate-spin" />
        <span class="text-sm">Waiting for first token...</span>
      </div>
      <p v-else-if="response.error" class="text-sm text-red-400">{{ response.error }}</p>
      <div v-else class="relative">
        <PlaygroundJsonStructuredPreview :content="response.content" />
        <span
          v-if="response.status === 'streaming'"
          class="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5"
        />
      </div>
      <ul v-if="response.assertionResults?.length" class="space-y-1 border-t border-border pt-3">
        <li
          v-for="result in response.assertionResults"
          :key="result.ruleId"
          class="text-xs flex gap-2"
        >
          <UiBadge :variant="result.pass ? 'success' : 'error'" class="shrink-0">
            {{ result.pass ? 'PASS' : 'FAIL' }}
          </UiBadge>
          <span class="text-muted-foreground">{{ result.message }}</span>
        </li>
      </ul>

      <div
        v-if="matchedCalls.length"
        class="space-y-2 border-t border-border pt-3"
      >
        <p class="text-xs font-medium">Simulate tool result</p>
        <p class="text-xs text-muted-foreground">
          Detected {{ matchedCalls.map(c => c.name).join(', ') }}. Paste mock JSON and continue this slot.
        </p>
        <select
          v-model="selectedTool"
          class="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option v-for="call in matchedCalls" :key="call.name" :value="call.name">
            {{ call.name }}
          </option>
        </select>
        <textarea
          v-model="mockJson"
          class="w-full min-h-24 rounded-md border border-border bg-card px-3 py-2 text-xs font-mono"
        />
        <UiButton size="sm" :disabled="!selectedTool" @click="continueTurn">
          Continue with mock
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>
