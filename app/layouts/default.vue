<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
    >
      {{ t('skipToContent') }}
    </a>
    <LayoutHeader />
    <main
      id="main-content"
      tabindex="-1"
      class="flex-1 container mx-auto px-4 py-6 lg:px-6 max-w-7xl"
    >
      <slot />
    </main>
  </div>
</template>
