<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import type { JsonPreviewNode } from '~/lib/jsonPreview'

defineOptions({ name: 'PlaygroundJsonTreeNode' })

defineProps<{
  node: JsonPreviewNode
  depth?: number
}>()

const open = ref(true)
</script>

<template>
  <div class="font-mono text-xs leading-relaxed" :style="{ paddingLeft: `${(depth ?? 0) * 12}px` }">
    <template v-if="node.kind === 'primitive'">
      <span v-if="node.key != null" class="text-sky-600 dark:text-sky-400">{{ node.key }}</span>
      <span v-if="node.key != null" class="text-muted-foreground">: </span>
      <span
        :class="{
          'text-emerald-600 dark:text-emerald-400': node.type === 'string',
          'text-amber-600 dark:text-amber-400': node.type === 'number',
          'text-violet-600 dark:text-violet-400': node.type === 'boolean',
          'text-muted-foreground': node.type === 'null',
        }"
      >{{ node.value }}</span>
    </template>

    <template v-else>
      <button
        type="button"
        class="inline-flex items-center gap-1 text-left hover:underline"
        @click="open = !open"
      >
        <span class="text-muted-foreground w-3">{{ open ? '▼' : '▶' }}</span>
        <span v-if="node.key != null" class="text-sky-600 dark:text-sky-400">{{ node.key }}</span>
        <span v-if="node.key != null" class="text-muted-foreground">: </span>
        <span class="text-muted-foreground">
          {{ node.kind === 'array' ? '[' : '{' }}
          <template v-if="!open">
            …{{ node.children.length }}
            {{ node.kind === 'array' ? ']' : '}' }}
          </template>
        </span>
      </button>
      <template v-if="open">
        <PlaygroundJsonTreeNode
          v-for="(child, index) in node.children"
          :key="`${node.key ?? 'root'}-${index}`"
          :node="child"
          :depth="(depth ?? 0) + 1"
        />
        <div class="text-muted-foreground" :style="{ paddingLeft: `${(depth ?? 0) * 12}px` }">
          {{ node.kind === 'array' ? ']' : '}' }}
        </div>
      </template>
    </template>
  </div>
</template>
