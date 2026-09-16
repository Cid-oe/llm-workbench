<script setup lang="ts">
import { ListChecks, Plus, Trash2 } from '@lucide/vue'
import type { AssertionKind, AssertionRule, LengthUnit } from '~/types/llm'
import { createAssertionId } from '~/lib/assertions'

const promptStore = usePromptStore()

const kindOptions: { value: AssertionKind, label: string }[] = [
  { value: 'jsonValid', label: 'JSON valid' },
  { value: 'jsonSchema', label: 'JSON Schema' },
  { value: 'forbiddenSubstring', label: 'Forbidden text' },
  { value: 'length', label: 'Length limits' },
]

const unitOptions: { value: LengthUnit, label: string }[] = [
  { value: 'characters', label: 'Characters' },
  { value: 'words', label: 'Words' },
  { value: 'tokens', label: 'Tokens (est.)' },
]

function addRule(kind: AssertionKind) {
  const rule: AssertionRule = {
    id: createAssertionId(),
    kind,
    enabled: true,
  }
  if (kind === 'forbiddenSubstring') rule.substring = ''
  if (kind === 'jsonSchema') rule.schemaJson = '{\n  "type": "object"\n}'
  if (kind === 'length') {
    rule.unit = 'characters'
    rule.max = 2000
  }
  promptStore.addAssertion(rule)
}
</script>

<template>
  <UiCard class="p-4 space-y-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 class="text-sm font-medium flex items-center gap-2">
          <ListChecks class="h-4 w-4" />
          Assertions / Checks
        </h3>
        <p class="text-xs text-muted-foreground mt-0.5">
          Evaluated client-side on each completed response. Results appear on cards and in History.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UiButton
          v-for="opt in kindOptions"
          :key="opt.value"
          size="sm"
          variant="outline"
          @click="addRule(opt.value)"
        >
          <Plus class="h-3.5 w-3.5" />
          {{ opt.label }}
        </UiButton>
      </div>
    </div>

    <p v-if="!promptStore.assertions.length" class="text-xs text-muted-foreground">
      No assertions yet. Add JSON, forbidden text, or length checks above.
    </p>

    <div
      v-for="rule in promptStore.assertions"
      :key="rule.id"
      class="rounded-md border border-border p-3 space-y-2"
    >
      <div class="flex items-center justify-between gap-2">
        <UiBadge variant="secondary">{{ kindOptions.find(k => k.value === rule.kind)?.label }}</UiBadge>
        <UiButton variant="ghost" size="sm" @click="promptStore.removeAssertion(rule.id)">
          <Trash2 class="h-4 w-4" />
        </UiButton>
      </div>

      <div v-if="rule.kind === 'forbiddenSubstring'">
        <UiLabel class="mb-1.5 block">Must not contain</UiLabel>
        <UiInput
          :model-value="rule.substring ?? ''"
          placeholder="e.g. Lo siento"
          @update:model-value="promptStore.updateAssertion(rule.id, { substring: String($event) })"
        />
      </div>

      <div v-else-if="rule.kind === 'jsonSchema'">
        <UiLabel class="mb-1.5 block">JSON Schema</UiLabel>
        <textarea
          class="w-full min-h-24 rounded-md border border-border bg-card px-3 py-2 text-xs font-mono"
          :value="rule.schemaJson ?? ''"
          @input="promptStore.updateAssertion(rule.id, { schemaJson: ($event.target as HTMLTextAreaElement).value })"
        />
      </div>

      <div v-else-if="rule.kind === 'length'" class="grid gap-2 sm:grid-cols-3">
        <div>
          <UiLabel class="mb-1.5 block">Unit</UiLabel>
          <select
            class="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            :value="rule.unit ?? 'characters'"
            @change="promptStore.updateAssertion(rule.id, { unit: ($event.target as HTMLSelectElement).value as LengthUnit })"
          >
            <option v-for="u in unitOptions" :key="u.value" :value="u.value">{{ u.label }}</option>
          </select>
        </div>
        <div>
          <UiLabel class="mb-1.5 block">Min</UiLabel>
          <UiInput
            type="number"
            :model-value="rule.min != null ? String(rule.min) : ''"
            placeholder="optional"
            @update:model-value="promptStore.updateAssertion(rule.id, { min: $event === '' ? undefined : Number($event) })"
          />
        </div>
        <div>
          <UiLabel class="mb-1.5 block">Max</UiLabel>
          <UiInput
            type="number"
            :model-value="rule.max != null ? String(rule.max) : ''"
            placeholder="optional"
            @update:model-value="promptStore.updateAssertion(rule.id, { max: $event === '' ? undefined : Number($event) })"
          />
        </div>
      </div>

      <p v-else class="text-xs text-muted-foreground">
        Response body must parse as JSON.
      </p>
    </div>
  </UiCard>
</template>
