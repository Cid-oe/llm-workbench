<script setup lang="ts">
import { diffLines, formatPromptForDiff } from '~/lib/promptDiff'

const promptStore = usePromptStore()

const selectedId = ref('')
const view = ref<'combined' | 'system' | 'user'>('combined')

const selected = computed(() =>
  promptStore.promptSnapshots.find(s => s.id === selectedId.value) ?? promptStore.promptSnapshots[0],
)

watch(
  () => promptStore.promptSnapshots.map(s => s.id).join(','),
  (ids) => {
    if (!selectedId.value || !ids.split(',').includes(selectedId.value)) {
      selectedId.value = promptStore.promptSnapshots[0]?.id ?? ''
    }
  },
  { immediate: true },
)

const currentText = computed(() => {
  if (view.value === 'system') return promptStore.systemPrompt
  if (view.value === 'user') return promptStore.userPrompt
  return formatPromptForDiff(promptStore.systemPrompt, promptStore.userPrompt)
})

const previousText = computed(() => {
  const snap = selected.value
  if (!snap) return ''
  if (view.value === 'system') return snap.systemPrompt
  if (view.value === 'user') return snap.userPrompt
  return formatPromptForDiff(snap.systemPrompt, snap.userPrompt)
})

const hunks = computed(() => diffLines(previousText.value, currentText.value))
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm text-muted-foreground">
      Compare the current editor against a saved revision or a past execution. Green is added; red was removed.
    </p>
    <div v-if="!promptStore.promptSnapshots.length" class="text-sm text-muted-foreground py-6 text-center">
      Save a prompt or run Compare once to create versions you can diff.
    </div>
    <template v-else>
      <div class="flex flex-wrap gap-3">
        <label class="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Prior version
          <select
            v-model="selectedId"
            class="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            <option v-for="snap in promptStore.promptSnapshots" :key="snap.id" :value="snap.id">
              {{ snap.label }}
            </option>
          </select>
        </label>
        <label class="flex w-40 flex-col gap-1 text-xs text-muted-foreground">
          View
          <select
            v-model="view"
            class="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            <option value="combined">System + User</option>
            <option value="system">System</option>
            <option value="user">User</option>
          </select>
        </label>
      </div>
      <pre class="max-h-96 overflow-auto rounded-md border border-border bg-muted/40 p-0 text-xs font-mono leading-5">
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
    </template>
  </div>
</template>
