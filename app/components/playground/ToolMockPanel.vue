<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { Plus, Trash2, Wrench } from '@lucide/vue'
import { createToolSignatureId } from '~/lib/toolCall'

const promptStore = usePromptStore()

function addTool() {
  promptStore.addToolSignature({
    id: createToolSignatureId(),
    name: 'get_weather',
    description: 'Example tool — rename and edit the schema as needed.',
    parametersJson: '{\n  "type": "object",\n  "properties": {\n    "city": { "type": "string" }\n  }\n}',
  })
}
</script>

<template>
  <UiCard class="p-4 space-y-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 class="text-sm font-medium flex items-center gap-2">
          <Wrench class="h-4 w-4" />
          Tool mocks
        </h3>
        <p class="text-xs text-muted-foreground mt-0.5">
        Register tool signatures locally. When a response looks like a tool call, simulate a JSON result or run a live MCP tool from Settings.
        </p>
      </div>
      <UiButton size="sm" variant="outline" @click="addTool">
        <Plus class="h-3.5 w-3.5" />
        Add tool
      </UiButton>
    </div>

    <p v-if="!promptStore.toolSignatures.length" class="text-xs text-muted-foreground">
      No tools registered yet.
    </p>

    <div
      v-for="tool in promptStore.toolSignatures"
      :key="tool.id"
      class="rounded-md border border-border p-3 space-y-2"
    >
      <div class="flex items-center justify-between gap-2">
        <UiInput
          :model-value="tool.name"
          placeholder="tool_name"
          class="max-w-xs"
          @update:model-value="promptStore.updateToolSignature(tool.id, { name: String($event) })"
        />
        <UiButton variant="ghost" size="sm" @click="promptStore.removeToolSignature(tool.id)">
          <Trash2 class="h-4 w-4" />
        </UiButton>
      </div>
      <UiInput
        :model-value="tool.description ?? ''"
        placeholder="Description (optional)"
        @update:model-value="promptStore.updateToolSignature(tool.id, { description: String($event) })"
      />
      <textarea
        class="w-full min-h-20 rounded-md border border-border bg-card px-3 py-2 text-xs font-mono"
        :value="tool.parametersJson ?? ''"
        placeholder="Parameters JSON Schema / description"
        @input="promptStore.updateToolSignature(tool.id, { parametersJson: ($event.target as HTMLTextAreaElement).value })"
      />
    </div>
  </UiCard>
</template>
