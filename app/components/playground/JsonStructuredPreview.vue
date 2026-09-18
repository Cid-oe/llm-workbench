<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { looksLikeJson, parseJsonPreview } from '~/lib/jsonPreview'

const props = defineProps<{ content: string }>()

const tab = ref<'raw' | 'structured'>('structured')

const eligible = computed(() => looksLikeJson(props.content))
const parsed = computed(() => parseJsonPreview(props.content))

watch(eligible, (ok) => {
  if (!ok) tab.value = 'raw'
}, { immediate: true })
</script>

<template>
  <div v-if="!eligible">
    <pre class="whitespace-pre-wrap text-sm font-mono leading-relaxed">{{ content }}</pre>
  </div>
  <div v-else class="space-y-2">
    <div class="flex gap-2">
      <UiButton
        size="sm"
        :variant="tab === 'raw' ? 'default' : 'outline'"
        @click="tab = 'raw'"
      >
        Raw
      </UiButton>
      <UiButton
        size="sm"
        :variant="tab === 'structured' ? 'default' : 'outline'"
        @click="tab = 'structured'"
      >
        Structured
      </UiButton>
      <UiBadge v-if="parsed.ok && parsed.label" variant="secondary">{{ parsed.label }}</UiBadge>
    </div>

    <pre v-if="tab === 'raw'" class="whitespace-pre-wrap text-sm font-mono leading-relaxed">{{ content }}</pre>

    <div v-else-if="parsed.ok" class="rounded-md border border-border bg-muted/20 p-3 overflow-auto">
      <PlaygroundJsonTreeNode :node="parsed.tree" />
    </div>
    <p v-else class="text-sm text-red-400">
      JSON parse error: {{ parsed.error }}
    </p>
  </div>
</template>
