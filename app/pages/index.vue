<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { Code2, GitCompare, Play, Save, Square, Table2 } from '@lucide/vue'
import type { ExportLanguage } from '~/composables/useCodeExporter'
import { promptFileName } from '~/lib/promptFile'
import { migrateModelId, PROVIDER_MODELS } from '~/lib/providerModels'
import type { PromptFileData } from '~/types/llm'

definePageMeta({ layout: 'default' })

const promptStore = usePromptStore()
const providerStore = useProviderStore()
const { exportCode } = useCodeExporter()
const {
  bulkResults,
  bulkProgress,
  canRun,
  runAll,
  continueWithTool,
  continueWithMcp,
  runBulkDataset,
  stopAll,
  clearBulkResults,
} = useCompareRunner()

const showExport = ref(false)
const exportTab = ref<'code' | 'prompt'>('code')
const exportLang = ref<ExportLanguage>('javascript')
const saveName = ref('')
const showSave = ref(false)
const showDiff = ref(false)
const showBulk = ref(false)
const importError = ref('')
const promptFileInput = ref<HTMLInputElement | null>(null)

const primarySlot = computed(() => providerStore.selectedModels[0])

const exportSnippet = computed(() => {
  const slot = primarySlot.value
  if (!slot) return ''
  return exportCode(exportLang.value, {
    provider: slot.provider,
    model: slot.modelId,
    systemPrompt: promptStore.interpolatedSystemPrompt,
    userPrompt: promptStore.interpolatedUserPrompt,
    ollamaUrl: providerStore.ollamaUrl,
    lmStudioUrl: providerStore.lmStudioUrl,
    temperature: promptStore.generation.temperature,
    maxTokens: promptStore.generation.maxTokens,
  })
})

const promptMarkdown = computed(() =>
  promptStore.exportPromptMarkdown({
    name: saveName.value.trim() || undefined,
    model: primarySlot.value?.modelId,
    provider: primarySlot.value?.provider,
  }),
)

function handleSave() {
  if (!saveName.value.trim()) return
  promptStore.savePrompt(saveName.value.trim(), [], {
    model: primarySlot.value?.modelId,
    provider: primarySlot.value?.provider,
  })
  saveName.value = ''
  showSave.value = false
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadPromptFile() {
  downloadText(promptFileName(saveName.value.trim() || 'prompt'), promptMarkdown.value)
}

function applyImportedModel(data: PromptFileData) {
  const modelId = data.model ? migrateModelId(data.model) : undefined
  if (!modelId) return
  const known = PROVIDER_MODELS.find(m => m.id === modelId)
  const slot = primarySlot.value
  if (!known || !slot) return
  providerStore.updateSlot(slot.slotId, data.provider ?? known.provider, known.id)
}

async function onPromptFileSelected(event: Event) {
  importError.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const markdown = await file.text()
    const data = promptStore.importPromptMarkdown(markdown)
    applyImportedModel(data)
    showExport.value = false
  }
  catch (error) {
    importError.value = error instanceof Error ? error.message : 'Could not parse the prompt file.'
  }
}

async function copyExport() {
  await navigator.clipboard.writeText(exportSnippet.value)
}

const languages: { id: ExportLanguage; label: string }[] = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'curl', label: 'cURL' },
  { id: 'php', label: 'PHP' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Compare</h1>
        <p class="text-sm text-muted-foreground">Run up to 4 LLM models in parallel</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UiButton variant="outline" size="sm" @click="showSave = true">
          <Save class="h-4 w-4" />
          Save
        </UiButton>
        <UiButton variant="outline" size="sm" @click="showDiff = true">
          <GitCompare class="h-4 w-4" />
          Diff
        </UiButton>
        <UiButton variant="outline" size="sm" @click="showExport = true">
          <Code2 class="h-4 w-4" />
          Export
        </UiButton>
        <UiButton variant="outline" size="sm" @click="showBulk = true">
          <Table2 class="h-4 w-4" />
          Bulk
        </UiButton>
        <UiButton v-if="promptStore.isRunning" variant="destructive" @click="stopAll">
          <Square class="h-4 w-4" />
          Stop
        </UiButton>
        <UiButton :disabled="!canRun || promptStore.isRunning" @click="runAll">
          <Play class="h-4 w-4" />
          Run All
        </UiButton>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="space-y-4">
        <PlaygroundPromptEditor />
        <PlaygroundVariablesInput />
        <PlaygroundGenerationControls />
        <PlaygroundAssertionsPanel />
        <PlaygroundToolMockPanel />
      </div>
      <PlaygroundModelSelector />
    </div>

    <div v-if="promptStore.responses.length">
      <h2 class="text-lg font-semibold mb-3">Responses</h2>
      <PlaygroundComparisonGrid
        :responses="promptStore.responses"
        @continue-with-tool="continueWithTool"
        @continue-with-mcp="continueWithMcp"
      />
    </div>

    <UiDialog :open="showExport" title="Export" size="lg" @close="showExport = false">
      <div class="flex gap-2 mb-4">
        <UiButton :variant="exportTab === 'code' ? 'default' : 'outline'" size="sm" @click="exportTab = 'code'">
          Code
        </UiButton>
        <UiButton :variant="exportTab === 'prompt' ? 'default' : 'outline'" size="sm" @click="exportTab = 'prompt'">
          .prompt
        </UiButton>
      </div>

      <template v-if="exportTab === 'code'">
        <div class="flex gap-2 mb-4">
          <UiButton
            v-for="lang in languages"
            :key="lang.id"
            :variant="exportLang === lang.id ? 'default' : 'outline'"
            size="sm"
            @click="exportLang = lang.id"
          >
            {{ lang.label }}
          </UiButton>
        </div>
        <pre class="rounded-md bg-muted p-4 text-xs overflow-auto max-h-80 font-mono">{{ exportSnippet }}</pre>
        <div class="flex justify-end gap-2 mt-4">
          <UiButton variant="outline" @click="showExport = false">Close</UiButton>
          <UiButton @click="copyExport">Copy</UiButton>
        </div>
      </template>

      <template v-else>
        <p class="text-sm text-muted-foreground mb-3">
          Git-friendly Markdown with YAML frontmatter. API keys are never written to this file.
        </p>
        <pre class="rounded-md bg-muted p-4 text-xs overflow-auto max-h-80 font-mono whitespace-pre-wrap">{{ promptMarkdown }}</pre>
        <p v-if="importError" class="mt-3 text-sm text-destructive">{{ importError }}</p>
        <input
          ref="promptFileInput"
          type="file"
          accept=".prompt,.md,.markdown,text/markdown"
          class="hidden"
          @change="onPromptFileSelected"
        >
        <div class="flex flex-wrap justify-end gap-2 mt-4">
          <UiButton variant="outline" @click="showExport = false">Close</UiButton>
          <UiButton variant="outline" @click="promptFileInput?.click()">Import</UiButton>
          <UiButton @click="downloadPromptFile">Download .prompt</UiButton>
        </div>
      </template>
    </UiDialog>

    <UiDialog :open="showDiff" title="Prompt version diff" size="lg" @close="showDiff = false">
      <PlaygroundPromptVersionDiff />
      <div class="flex justify-end mt-4">
        <UiButton variant="outline" @click="showDiff = false">Close</UiButton>
      </div>
    </UiDialog>

    <UiDialog :open="showSave" title="Save Prompt" @close="showSave = false">
      <UiLabel class="mb-1.5 block">Name</UiLabel>
      <UiInput v-model="saveName" placeholder="My prompt collection" />
      <div class="flex justify-end gap-2 mt-4">
        <UiButton variant="outline" @click="showSave = false">Cancel</UiButton>
        <UiButton @click="handleSave">Save</UiButton>
      </div>
    </UiDialog>

    <PlaygroundBulkDatasetPanel
      :open="showBulk"
      :variables="promptStore.detectedVariables"
      :can-run="canRun"
      :is-running="promptStore.isRunning"
      :results="bulkResults"
      :progress-label="bulkProgress"
      @close="showBulk = false"
      @start="runBulkDataset"
      @stop="stopAll"
      @clear="clearBulkResults"
    />
  </div>
</template>
