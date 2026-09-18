<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
const props = defineProps<{ for?: string }>()
</script>

<template>
  <label :for="props.for" class="text-sm font-medium text-foreground">
    <slot />
  </label>
</template>
