<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { cn } from '~/lib/utils'
import { X } from '@lucide/vue'

withDefaults(defineProps<{ open: boolean; title?: string; size?: 'md' | 'lg' }>(), {
  title: '',
  size: 'md',
})
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/60" @click="$emit('close')" />
      <div :class="cn('relative z-10 w-full rounded-lg border border-border bg-card p-6 shadow-xl mx-4', size === 'lg' ? 'max-w-4xl' : 'max-w-2xl')">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">{{ title }}</h2>
          <button class="text-muted-foreground hover:text-foreground" @click="$emit('close')">
            <X class="h-5 w-5" />
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
