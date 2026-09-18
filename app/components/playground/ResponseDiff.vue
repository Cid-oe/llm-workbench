<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { diffLines, toSplitDiffRows } from '~/lib/promptDiff'
import type { ModelResponse } from '~/types/llm'

const props = defineProps<{ responses: ModelResponse[] }>()

const providerStore = useProviderStore()

const mode = ref<'unified' | 'split'>('unified')
const baselineId = ref('')
const targetId = ref('')

const doneResponses = computed(() =>
  props.responses.filter(r => r.status === 'done' && r.content.length > 0),
)

function labelFor(response: ModelResponse): string {
  return providerStore.getModel(response.modelId)?.label ?? response.modelId
}

watch(
  doneResponses,
  (list) => {
    const ids = list.map(r => r.slotId)
    if (!ids.includes(baselineId.value)) baselineId.value = ids[0] ?? ''
    if (!ids.includes(targetId.value) || targetId.value === baselineId.value) {
      targetId.value = ids.find(id => id !== baselineId.value) ?? ''
    }
  },
  { immediate: true },
)

const baseline = computed(() => doneResponses.value.find(r => r.slotId === baselineId.value))
const target = computed(() => doneResponses.value.find(r => r.slotId === targetId.value))

const canDiff = computed(() =>
  !!baseline.value && !!target.value && baseline.value.slotId !== target.value.slotId,
)

const hunks = computed(() => {
  if (!canDiff.value || !baseline.value || !target.value) return []
  return diffLines(baseline.value.content, target.value.content)
})

const splitRows = computed(() => toSplitDiffRows(hunks.value))
</script>

<template>
  <UiCard v-if="doneResponses.length >= 2" class="p-4 space-y-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 class="text-sm font-medium">Response diff</h3>
        <p class="text-xs text-muted-foreground mt-0.5">
          Line-level LCS diff (no extra dependency). Best for short-to-medium replies; not word-level.
        </p>
      </div>
      <div class="flex gap-2">
        <UiButton
          size="sm"
          :variant="mode === 'unified' ? 'default' : 'outline'"
          @click="mode = 'unified'"
        >
          Unified
        </UiButton>
        <UiButton
          size="sm"
          :variant="mode === 'split' ? 'default' : 'outline'"
          @click="mode = 'split'"
        >
          Side-by-side
        </UiButton>
      </div>
    </div>

    <div class="flex flex-wrap gap-3">
      <label class="flex min-w-40 flex-1 flex-col gap-1 text-xs text-muted-foreground">
        Baseline
        <select
          v-model="baselineId"
          class="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          <option v-for="response in doneResponses" :key="response.slotId" :value="response.slotId">
            {{ labelFor(response) }}
          </option>
        </select>
      </label>
      <label class="flex min-w-40 flex-1 flex-col gap-1 text-xs text-muted-foreground">
        Compare to
        <select
          v-model="targetId"
          class="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          <option
            v-for="response in doneResponses.filter(r => r.slotId !== baselineId)"
            :key="response.slotId"
            :value="response.slotId"
          >
            {{ labelFor(response) }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="!canDiff" class="text-sm text-muted-foreground">
      Select two different completed responses to diff.
    </p>

    <pre
      v-else-if="mode === 'unified'"
      class="max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-0 text-xs font-mono leading-5"
    >
      <div
        v-for="(line, idx) in hunks"
        :key="idx"
        :class="{
          'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200': line.kind === 'add',
          'bg-red-500/15 text-red-800 dark:text-red-200 line-through': line.kind === 'remove',
          'text-foreground': line.kind === 'equal',
        }"
        class="px-3 whitespace-pre-wrap"
      >{{ line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' ' }} {{ line.text }}</div>
    </pre>

    <div
      v-else
      class="max-h-80 overflow-auto rounded-md border border-border bg-muted/40 text-xs font-mono leading-5"
    >
      <div class="grid grid-cols-2 border-b border-border sticky top-0 bg-muted/80 backdrop-blur-sm">
        <div class="px-3 py-1.5 font-medium truncate">{{ labelFor(baseline!) }}</div>
        <div class="px-3 py-1.5 font-medium truncate border-l border-border">{{ labelFor(target!) }}</div>
      </div>
      <div
        v-for="(row, idx) in splitRows"
        :key="idx"
        class="grid grid-cols-2"
      >
        <div
          class="px-3 whitespace-pre-wrap min-h-[1.25rem]"
          :class="{
            'bg-red-500/15 text-red-800 dark:text-red-200': row.left?.kind === 'remove',
            'text-foreground': row.left?.kind === 'equal',
            'text-muted-foreground/40': !row.left,
          }"
        >{{ row.left?.text ?? '' }}</div>
        <div
          class="px-3 whitespace-pre-wrap min-h-[1.25rem] border-l border-border"
          :class="{
            'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200': row.right?.kind === 'add',
            'text-foreground': row.right?.kind === 'equal',
            'text-muted-foreground/40': !row.right,
          }"
        >{{ row.right?.text ?? '' }}</div>
      </div>
    </div>
  </UiCard>
</template>
