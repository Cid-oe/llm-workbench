<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { Download, Table2, Upload } from '@lucide/vue'
import {
  MAX_DATASET_ROWS,
  autoMapColumns,
  parseDataset,
  serializeBulkResultsCsv,
  serializeBulkResultsJson,
  type BulkCaseResult,
  type ColumnMapping,
  type DatasetTable,
} from '~/lib/dataset'
import type { JudgeAggregate } from '~/types/llm'

const props = defineProps<{
  open: boolean
  variables: string[]
  canRun: boolean
  isRunning: boolean
  results: BulkCaseResult[]
  progressLabel: string
  judgeAggregates?: JudgeAggregate[]
}>()

const { t } = useI18n()
const { formatCost, formatLatency } = useCostCalculator()

const emit = defineEmits<{
  close: []
  start: [payload: { rows: Record<string, string>[], mapping: ColumnMapping }]
  stop: []
  clear: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const error = ref('')
const dataset = ref<DatasetTable | null>(null)
const mapping = ref<ColumnMapping>({})
const fileName = ref('')

watch(() => props.open, (open) => {
  if (!open) return
  error.value = ''
})

watch(() => props.variables, (vars) => {
  if (!dataset.value) return
  const previous = { ...mapping.value }
  const next = autoMapColumns(dataset.value.columns, vars)
  for (const variable of vars) {
    if (previous[variable]) next[variable] = previous[variable]!
  }
  mapping.value = next
})

const mappedCount = computed(() =>
  props.variables.filter(v => mapping.value[v]).length,
)

async function onFileSelected(event: Event) {
  error.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const table = parseDataset(text, file.name)
    dataset.value = table
    fileName.value = file.name
    mapping.value = autoMapColumns(table.columns, props.variables)
  }
  catch (err) {
    dataset.value = null
    fileName.value = ''
    mapping.value = {}
    error.value = err instanceof Error ? err.message : 'Could not parse dataset'
  }
}

function startBulk() {
  if (!dataset.value) {
    error.value = 'Upload a CSV or JSON dataset first'
    return
  }
    if (!props.variables.length) {
    error.value = 'Add {{variable}} placeholders to your prompts before running a dataset'
    return
  }
  if (mappedCount.value === 0) {
    error.value = 'Map at least one variable to a dataset column'
    return
  }
  error.value = ''
  emit('start', { rows: dataset.value.rows, mapping: { ...mapping.value } })
}

function downloadResults(format: 'csv' | 'json') {
  const content = format === 'csv'
    ? serializeBulkResultsCsv(props.results)
    : serializeBulkResultsJson(props.results)
  const blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = format === 'csv' ? 'bulk-results.csv' : 'bulk-results.json'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <UiDialog :open="open" title="Bulk dataset run" size="lg" @close="emit('close')">
    <p class="text-sm text-muted-foreground mb-4">
      Upload a CSV or JSON file (max {{ MAX_DATASET_ROWS }} rows). Columns map to prompt
      <code class="text-xs">{<!-- -->{variable}}</code> placeholders. Each row runs the selected models once.
    </p>

    <div class="flex flex-wrap items-center gap-2 mb-4">
      <input
        ref="fileInput"
        type="file"
        accept=".csv,.json,text/csv,application/json"
        class="hidden"
        @change="onFileSelected"
      >
      <UiButton variant="outline" size="sm" :disabled="isRunning" @click="fileInput?.click()">
        <Upload class="h-4 w-4" />
        Upload CSV / JSON
      </UiButton>
      <span v-if="fileName" class="text-xs text-muted-foreground truncate">
        {{ fileName }} · {{ dataset?.rows.length ?? 0 }} rows
      </span>
    </div>

    <p v-if="error" class="text-sm text-destructive mb-3">{{ error }}</p>

    <div v-if="dataset && variables.length" class="space-y-2 mb-4">
      <h3 class="text-sm font-medium">Column mapping</h3>
      <div
        v-for="variable in variables"
        :key="variable"
        class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm"
      >
        <code class="truncate">{{ variable }}</code>
        <span class="text-muted-foreground">←</span>
        <select
          v-model="mapping[variable]"
          class="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          :disabled="isRunning"
        >
          <option value="">(ignore)</option>
          <option v-for="column in dataset.columns" :key="column" :value="column">
            {{ column }}
          </option>
        </select>
      </div>
    </div>

    <div v-else-if="dataset && !variables.length" class="text-sm text-muted-foreground mb-4">
      No variables detected in the current prompts.
    </div>

    <div v-if="progressLabel" class="text-xs text-muted-foreground mb-3">
      {{ progressLabel }}
    </div>

    <div v-if="judgeAggregates?.length" class="mb-4 space-y-2">
      <h3 class="text-sm font-medium">{{ t('judge.aggregates') }}</h3>
      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full text-xs">
          <thead class="bg-muted/40">
            <tr class="text-left">
              <th class="px-2 py-1.5 font-medium">Model</th>
              <th class="px-2 py-1.5 font-medium">{{ t('judge.meanScore') }}</th>
              <th class="px-2 py-1.5 font-medium">{{ t('judge.passRate') }}</th>
              <th class="px-2 py-1.5 font-medium">{{ t('judge.meanLatency') }}</th>
              <th class="px-2 py-1.5 font-medium">{{ t('judge.estCost') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="agg in judgeAggregates"
              :key="agg.modelId"
              class="border-t border-border"
            >
              <td class="px-2 py-1.5 font-mono">{{ agg.modelId }}</td>
              <td class="px-2 py-1.5">
                {{ agg.meanScore == null ? '—' : agg.meanScore.toFixed(2) }}
              </td>
              <td class="px-2 py-1.5">
                {{ agg.passRate == null ? '—' : `${Math.round(agg.passRate * 100)}%` }}
              </td>
              <td class="px-2 py-1.5">
                {{ agg.meanLatencyMs == null ? '—' : formatLatency(agg.meanLatencyMs) }}
              </td>
              <td class="px-2 py-1.5">
                {{ agg.estimatedCostUsd == null ? '—' : formatCost(agg.estimatedCostUsd) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="results.length" class="mb-4">
      <div class="flex items-center justify-between gap-2 mb-2">
        <h3 class="text-sm font-medium flex items-center gap-1.5">
          <Table2 class="h-4 w-4" />
          Results
        </h3>
        <div class="flex gap-2">
          <UiButton variant="outline" size="sm" :disabled="isRunning" @click="downloadResults('csv')">
            <Download class="h-4 w-4" />
            CSV
          </UiButton>
          <UiButton variant="outline" size="sm" :disabled="isRunning" @click="downloadResults('json')">
            <Download class="h-4 w-4" />
            JSON
          </UiButton>
          <UiButton variant="outline" size="sm" :disabled="isRunning" @click="emit('clear')">
            Clear
          </UiButton>
        </div>
      </div>
      <div class="overflow-x-auto max-h-64 rounded-md border border-border">
        <table class="w-full text-xs">
          <thead class="bg-muted/40 sticky top-0">
            <tr class="text-left">
              <th class="px-2 py-1.5 font-medium">#</th>
              <th class="px-2 py-1.5 font-medium">Status</th>
              <th class="px-2 py-1.5 font-medium">Variables</th>
              <th class="px-2 py-1.5 font-medium">Models</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in results" :key="row.index" class="border-t border-border align-top">
              <td class="px-2 py-1.5">{{ row.index + 1 }}</td>
              <td class="px-2 py-1.5">{{ row.status }}</td>
              <td class="px-2 py-1.5 font-mono whitespace-pre-wrap break-all">
                {{ Object.entries(row.variables).map(([k, v]) => `${k}=${v}`).join(', ') }}
              </td>
              <td class="px-2 py-1.5 space-y-1">
                <div v-for="model in row.models" :key="model.modelId">
                  <span class="font-medium">{{ model.label }}</span>
                  · {{ model.status }}
                  · {{ Math.round(model.latencyMs) }}ms
                  <span v-if="model.judgeOverall != null">
                    · {{ t('judge.score') }} {{ model.judgeOverall.toFixed(1) }}
                    ({{ model.judgePass ? 'PASS' : 'FAIL' }})
                  </span>
                  <span v-if="model.error" class="text-destructive"> — {{ model.error }}</span>
                  <div v-else class="text-muted-foreground">{{ model.outputPreview || '—' }}</div>
                  <div v-if="model.judgeRationale" class="text-muted-foreground">
                    {{ model.judgeRationale }}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex flex-wrap justify-end gap-2 mt-2">
      <UiButton variant="outline" @click="emit('close')">Close</UiButton>
      <UiButton v-if="isRunning" variant="destructive" @click="emit('stop')">Stop</UiButton>
      <UiButton :disabled="!canRun || isRunning || !dataset" @click="startBulk">
        Run dataset
      </UiButton>
    </div>
  </UiDialog>
</template>
