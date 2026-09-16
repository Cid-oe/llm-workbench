<script setup lang="ts">
import { Code2, GitCompare, Play, Save, Square, Table2 } from '@lucide/vue'
import type { ExportLanguage } from '~/composables/useCodeExporter'
import {
  applyColumnMapping,
  truncatePreview,
  type BulkCaseResult,
  type BulkModelResult,
  type ColumnMapping,
} from '~/lib/dataset'
import { markInFlightAsCancelled, shouldPersistRunHistory } from '~/lib/runHistory'
import { evaluateAssertions, summarizeResponses } from '~/lib/assertions'
import { promptFileName } from '~/lib/promptFile'
import { migrateModelId, PROVIDER_MODELS } from '~/lib/providerModels'
import { interpolateVariables } from '~/lib/variables'
import type { ModelResponse, PromptFileData, PromptVariables } from '~/types/llm'

definePageMeta({ layout: 'default' })

const promptStore = usePromptStore()
const providerStore = useProviderStore()
const { streamCompletion } = useLLMStream()
const { estimateTokens, calculateCost } = useCostCalculator()
const { exportCode } = useCodeExporter()

const abortControllers = ref<AbortController[]>([])
const showExport = ref(false)
const exportTab = ref<'code' | 'prompt'>('code')
const exportLang = ref<ExportLanguage>('javascript')
const saveName = ref('')
const showSave = ref(false)
const showDiff = ref(false)
const showBulk = ref(false)
const importError = ref('')
const promptFileInput = ref<HTMLInputElement | null>(null)
const bulkResults = ref<BulkCaseResult[]>([])
const bulkProgress = ref('')
const bulkCancelled = ref(false)

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

const canRun = computed(() =>
  providerStore.selectedModels.every(s => providerStore.isProviderConfigured(s.provider)),
)

function createEmptyResponse(slotId: string, provider: ModelResponse['provider'], modelId: string): ModelResponse {
  const model = PROVIDER_MODELS.find(m => m.id === modelId)
  const inputText = promptStore.interpolatedSystemPrompt + promptStore.interpolatedUserPrompt
  const inputTokens = estimateTokens(inputText)

  return {
    slotId,
    provider,
    modelId,
    content: '',
    status: 'idle',
    metrics: {
      latencyMs: 0,
      ttftMs: null,
      inputTokens,
      outputTokens: 0,
      costUsd: calculateCost(model, inputTokens, 0),
    },
  }
}

async function runSlotStream(
  slot: { slotId: string, provider: ModelResponse['provider'], modelId: string },
  prompts: { systemPrompt: string, userPrompt: string },
  options?: {
    onUpdate?: (partial: Partial<ModelResponse> & { content?: string }) => void
    updateStore?: boolean
  },
): Promise<{ content: string, status: ModelResponse['status'], latencyMs: number, error?: string }> {
  const controller = new AbortController()
  abortControllers.value.push(controller)
  const startTime = performance.now()
  let content = ''
  let status: ModelResponse['status'] = 'streaming'
  let errorMessage: string | undefined
  const inputTokens = estimateTokens(prompts.systemPrompt + prompts.userPrompt)
  const baseMetrics = {
    latencyMs: 0,
    ttftMs: null as number | null,
    inputTokens,
    outputTokens: 0,
    costUsd: calculateCost(PROVIDER_MODELS.find(m => m.id === slot.modelId), inputTokens, 0),
  }

  if (options?.updateStore !== false) {
    promptStore.updateResponse(slot.slotId, { status: 'streaming' })
  }

  await streamCompletion(
    {
      provider: slot.provider,
      model: slot.modelId,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      apiKey: providerStore.getApiKey(slot.provider),
      ollamaUrl: providerStore.ollamaUrl,
      lmStudioUrl: providerStore.lmStudioUrl,
      temperature: promptStore.generation.temperature,
      maxTokens: promptStore.generation.maxTokens,
    },
    {
      onChunk: (text) => {
        content += text
        const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
        const outputTokens = estimateTokens(content)
        const metrics = {
          ...baseMetrics,
          outputTokens,
          costUsd: calculateCost(model, inputTokens, outputTokens),
          latencyMs: performance.now() - startTime,
        }
        options?.onUpdate?.({ content, metrics })
        if (options?.updateStore !== false) {
          promptStore.updateResponse(slot.slotId, { content, metrics })
        }
      },
      onFirstToken: (ttftMs) => {
        baseMetrics.ttftMs = ttftMs
        if (options?.updateStore !== false) {
          const current = promptStore.responses.find(r => r.slotId === slot.slotId)
          if (!current) return
          promptStore.updateResponse(slot.slotId, {
            metrics: { ...current.metrics, ttftMs },
          })
        }
      },
      onDone: () => {
        status = 'done'
        const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
        const outputTokens = estimateTokens(content)
        const metrics = {
          ...baseMetrics,
          outputTokens,
          costUsd: calculateCost(model, inputTokens, outputTokens),
          latencyMs: performance.now() - startTime,
        }
        if (options?.updateStore !== false) {
          promptStore.updateResponse(slot.slotId, { status: 'done', metrics })
        }
      },
      onError: (error) => {
        status = 'error'
        errorMessage = error.message
        const metrics = {
          ...baseMetrics,
          latencyMs: performance.now() - startTime,
        }
        if (options?.updateStore !== false) {
          promptStore.updateResponse(slot.slotId, {
            status: 'error',
            error: error.message,
            metrics,
          })
        }
      },
    },
    controller.signal,
  )

  if (controller.signal.aborted && (status === 'streaming' || status === 'idle')) {
    status = 'cancelled'
    const metrics = {
      ...baseMetrics,
      outputTokens: estimateTokens(content),
      latencyMs: performance.now() - startTime,
    }
    if (options?.updateStore !== false) {
      promptStore.updateResponse(slot.slotId, {
        status: 'cancelled',
        content,
        metrics,
      })
    }
  }

  return {
    content,
    status,
    latencyMs: performance.now() - startTime,
    error: errorMessage,
  }
}

async function runAll() {
  stopAll()
  promptStore.isRunning = true
  abortControllers.value = []

  const initialResponses = providerStore.selectedModels.map(slot =>
    createEmptyResponse(slot.slotId, slot.provider, slot.modelId),
  )
  promptStore.setResponses(initialResponses)

  const prompts = {
    systemPrompt: promptStore.interpolatedSystemPrompt,
    userPrompt: promptStore.interpolatedUserPrompt,
  }

  await Promise.allSettled(
    providerStore.selectedModels.map(slot => runSlotStream(slot, prompts)),
  )

  promptStore.setResponses(markInFlightAsCancelled(promptStore.responses))

  if (promptStore.assertions.length) {
    for (const response of promptStore.responses) {
      if (response.status !== 'done') continue
      promptStore.updateResponse(response.slotId, {
        assertionResults: evaluateAssertions(promptStore.assertions, response.content),
      })
    }
  }

  promptStore.isRunning = false

  if (shouldPersistRunHistory(promptStore.responses)) {
    promptStore.addToHistory(
      promptStore.responses,
      providerStore.selectedModels.map(s => ({ ...s })),
      summarizeResponses(promptStore.responses),
    )
  }
}

async function runBulkDataset(payload: { rows: Record<string, string>[], mapping: ColumnMapping }) {
  stopAll()
  bulkCancelled.value = false
  promptStore.isRunning = true
  abortControllers.value = []
  bulkResults.value = payload.rows.map((row, index) => ({
    index,
    variables: applyColumnMapping(row, payload.mapping, { ...promptStore.variables }),
    status: 'pending',
    models: [],
  }))

  for (let i = 0; i < payload.rows.length; i++) {
    if (bulkCancelled.value) {
      for (let j = i; j < bulkResults.value.length; j++) {
        const pending = bulkResults.value[j]
        if (pending) pending.status = 'cancelled'
      }
      break
    }

    const caseResult = bulkResults.value[i]
    if (!caseResult) continue
    caseResult.status = 'running'
    bulkProgress.value = `Running row ${i + 1} of ${payload.rows.length}`

    const vars: PromptVariables = caseResult.variables
    const prompts = {
      systemPrompt: interpolateVariables(promptStore.systemPrompt, vars),
      userPrompt: interpolateVariables(promptStore.userPrompt, vars),
    }

    const modelResults = await Promise.all(
      providerStore.selectedModels.map(async (slot): Promise<BulkModelResult> => {
        const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
        const result = await runSlotStream(slot, prompts, { updateStore: false })
        const aborted = bulkCancelled.value || result.status === 'cancelled' || result.status === 'streaming' || result.status === 'idle'
        return {
          modelId: slot.modelId,
          label: model?.label ?? slot.modelId,
          status: result.status === 'done'
            ? 'done'
            : result.status === 'cancelled'
              ? 'cancelled'
              : 'error',
          latencyMs: result.latencyMs,
          outputPreview: truncatePreview(result.content),
          error: result.error ?? (aborted ? 'Cancelled' : undefined),
        }
      }),
    )

    caseResult.models = modelResults
    caseResult.status = bulkCancelled.value
      ? 'cancelled'
      : modelResults.some(m => m.status === 'error')
        ? 'error'
        : 'done'
  }

  bulkProgress.value = bulkCancelled.value
    ? 'Bulk run stopped'
    : `Finished ${bulkResults.value.filter(r => r.status === 'done' || r.status === 'error').length} rows`
  promptStore.isRunning = false
}

function stopAll() {
  bulkCancelled.value = true
  abortControllers.value.forEach(c => c.abort())
  abortControllers.value = []
  if (promptStore.responses.some(r => r.status === 'streaming' || r.status === 'idle')) {
    promptStore.setResponses(markInFlightAsCancelled(promptStore.responses))
  }
  promptStore.isRunning = false
}

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
      </div>
      <PlaygroundModelSelector />
    </div>

    <div v-if="promptStore.responses.length">
      <h2 class="text-lg font-semibold mb-3">Responses</h2>
      <PlaygroundComparisonGrid :responses="promptStore.responses" />
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
      @clear="bulkResults = []; bulkProgress = ''"
    />
  </div>
</template>
