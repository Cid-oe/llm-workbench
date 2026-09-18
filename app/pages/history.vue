<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { Bookmark, Clock, Download, Trash2, Upload } from '@lucide/vue'
import { formatDateTime } from '~/lib/formatDate'
import { PromptBackupError, type PromptBackupMode } from '~/lib/promptBackup'
import { promptFileName, serializePromptFile } from '~/lib/promptFile'
import type { SavedPrompt } from '~/types/llm'

definePageMeta({ layout: 'default' })

const promptStore = usePromptStore()

const activeTab = ref<'history' | 'saved'>('history')
const backupInput = ref<HTMLInputElement | null>(null)
const backupError = ref('')
const backupNotice = ref('')

function downloadSavedPrompt(prompt: SavedPrompt) {
  const markdown = serializePromptFile({
    name: prompt.name,
    tags: prompt.tags,
    model: prompt.model,
    provider: prompt.provider,
    generation: prompt.generation,
    variables: { ...(prompt.variables ?? {}) },
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
  })
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = promptFileName(prompt.name)
  a.click()
  URL.revokeObjectURL(url)
}

function exportBackup() {
  backupError.value = ''
  backupNotice.value = ''
  const content = promptStore.exportBackupJson()
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `llm-workbench-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  backupNotice.value = 'Backup exported (history + saved prompts). API keys are never included.'
}

function chooseImportMode(): PromptBackupMode | null {
  const replace = window.confirm(
    'Import backup\n\nOK = Replace current history and saved prompts\nCancel = choose Merge instead',
  )
  if (replace) return 'replace'
  const merge = window.confirm(
    'Merge imported items with your current library?\n\nOK = Merge by id\nCancel = abort import',
  )
  return merge ? 'merge' : null
}

async function onBackupSelected(event: Event) {
  backupError.value = ''
  backupNotice.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const mode = chooseImportMode()
  if (!mode) {
    backupNotice.value = 'Import cancelled.'
    return
  }

  try {
    const text = await file.text()
    const counts = promptStore.importBackupJson(text, mode)
    backupNotice.value = `Imported ${counts.history} history entr${counts.history === 1 ? 'y' : 'ies'} and ${counts.savedPrompts} saved prompt${counts.savedPrompts === 1 ? '' : 's'} (${mode}).`
  }
  catch (error) {
    backupError.value = error instanceof PromptBackupError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Could not import backup'
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">History & Library</h1>
        <p class="text-sm text-muted-foreground">Past executions and saved prompt collections</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <input
          ref="backupInput"
          type="file"
          accept=".json,application/json"
          class="hidden"
          @change="onBackupSelected"
        >
        <UiButton variant="outline" size="sm" @click="exportBackup">
          <Download class="h-4 w-4" />
          Export JSON
        </UiButton>
        <UiButton variant="outline" size="sm" @click="backupInput?.click()">
          <Upload class="h-4 w-4" />
          Import JSON
        </UiButton>
      </div>
    </div>

    <p v-if="backupNotice" class="text-sm text-muted-foreground">{{ backupNotice }}</p>
    <p v-if="backupError" class="text-sm text-destructive">{{ backupError }}</p>

    <div class="flex gap-2">
      <UiButton
        :variant="activeTab === 'history' ? 'default' : 'outline'"
        size="sm"
        @click="activeTab = 'history'"
      >
        <Clock class="h-4 w-4" />
        History ({{ promptStore.history.length }})
      </UiButton>
      <UiButton
        :variant="activeTab === 'saved' ? 'default' : 'outline'"
        size="sm"
        @click="activeTab = 'saved'"
      >
        <Bookmark class="h-4 w-4" />
        Saved ({{ promptStore.savedPrompts.length }})
      </UiButton>
    </div>

    <div v-if="activeTab === 'history'" class="space-y-3">
      <div v-if="!promptStore.history.length" class="text-center py-12 text-muted-foreground">
        No executions yet. Run a prompt from Compare.
      </div>
      <UiCard
        v-for="entry in promptStore.history"
        :key="entry.id"
        class="p-4 hover:border-primary/40 transition-colors cursor-pointer"
        @click="promptStore.loadFromHistory(entry.id)"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 min-w-0">
              <p class="text-sm font-medium truncate">{{ entry.userPrompt }}</p>
              <UiBadge
                v-if="entry.assertionSummary === 'pass'"
                variant="success"
              >
                PASS
              </UiBadge>
              <UiBadge
                v-else-if="entry.assertionSummary === 'fail'"
                variant="error"
              >
                FAIL
              </UiBadge>
            </div>
            <p class="text-xs text-muted-foreground mt-1">
              {{ formatDateTime(entry.createdAt) }} · {{ entry.models.length }} model(s)
            </p>
          </div>
          <UiButton variant="outline" size="sm" @click.stop="navigateTo('/')">
            Load
          </UiButton>
        </div>
      </UiCard>
      <div v-if="promptStore.history.length" class="flex justify-end">
        <UiButton variant="outline" size="sm" @click="promptStore.clearHistory()">
          <Trash2 class="h-4 w-4" />
          Clear history
        </UiButton>
      </div>
    </div>

    <div v-else class="space-y-3">
      <div v-if="!promptStore.savedPrompts.length" class="text-center py-12 text-muted-foreground">
        No saved prompts yet.
      </div>
      <UiCard
        v-for="prompt in promptStore.savedPrompts"
        :key="prompt.id"
        class="p-4"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium">{{ prompt.name }}</p>
              <UiBadge variant="secondary">v{{ prompt.version }}</UiBadge>
            </div>
            <p class="text-xs text-muted-foreground mt-1 truncate">{{ prompt.userPrompt }}</p>
            <div v-if="prompt.tags.length" class="flex gap-1 mt-2">
              <UiBadge v-for="tag in prompt.tags" :key="tag" variant="secondary">{{ tag }}</UiBadge>
            </div>
          </div>
          <div class="flex gap-2">
            <UiButton variant="outline" size="sm" @click="downloadSavedPrompt(prompt)">
              <Download class="h-4 w-4" />
              .prompt
            </UiButton>
            <UiButton variant="outline" size="sm" @click="promptStore.loadPrompt(prompt.id); navigateTo('/')">
              Load
            </UiButton>
            <UiButton variant="ghost" size="sm" @click="promptStore.deleteSavedPrompt(prompt.id)">
              <Trash2 class="h-4 w-4" />
            </UiButton>
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>
