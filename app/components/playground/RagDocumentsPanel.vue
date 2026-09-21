<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { FileText, Trash2, Upload } from '@lucide/vue'
import {
  RAG_DEFAULT_TOP_K,
  RAG_MAX_DOCUMENTS,
  RAG_MAX_FILE_BYTES,
  type RagEmbedBackend,
} from '~/lib/rag'

const ragStore = useRagStore()
const { t } = useI18n()
const fileInput = ref<HTMLInputElement | null>(null)

function translateError(key: string) {
  if (!key) return ''
  const msg = t(key)
  return msg === key ? t('rag.ingestFailed') : msg
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    await ragStore.addDocument(file)
  }
  catch {
    // error key already stored
  }
}

function onBackendChange(value: string) {
  ragStore.embedBackend = (value === 'ollama' ? 'ollama' : 'local') as RagEmbedBackend
}
</script>

<template>
  <UiCard class="p-4 space-y-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 class="text-sm font-medium flex items-center gap-2">
          <FileText class="h-4 w-4" />
          {{ t('rag.title') }}
        </h3>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ t('rag.subtitle') }}
        </p>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-border"
          :checked="ragStore.enabled"
          @change="ragStore.enabled = ($event.target as HTMLInputElement).checked"
        >
        {{ t('rag.enable') }}
      </label>
    </div>

    <template v-if="ragStore.enabled">
      <p class="text-xs text-muted-foreground">
        {{ t('rag.limits', {
          maxDocs: RAG_MAX_DOCUMENTS,
          maxKb: Math.round(RAG_MAX_FILE_BYTES / 1024),
        }) }}
      </p>

      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <UiLabel class="mb-1.5 block">{{ t('rag.chunkSize') }}</UiLabel>
          <UiInput
            type="number"
            :model-value="String(ragStore.chunkSize)"
            @update:model-value="ragStore.chunkSize = Number($event) || ragStore.chunkSize"
          />
        </div>
        <div>
          <UiLabel class="mb-1.5 block">{{ t('rag.chunkOverlap') }}</UiLabel>
          <UiInput
            type="number"
            :model-value="String(ragStore.chunkOverlap)"
            @update:model-value="ragStore.chunkOverlap = Number($event) || 0"
          />
        </div>
        <div>
          <UiLabel class="mb-1.5 block">{{ t('rag.topK') }}</UiLabel>
          <UiInput
            type="number"
            :model-value="String(ragStore.topK)"
            :placeholder="String(RAG_DEFAULT_TOP_K)"
            @update:model-value="ragStore.topK = Number($event) || RAG_DEFAULT_TOP_K"
          />
        </div>
        <div>
          <UiLabel class="mb-1.5 block">{{ t('rag.embedBackend') }}</UiLabel>
          <select
            class="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            :value="ragStore.embedBackend"
            @change="onBackendChange(($event.target as HTMLSelectElement).value)"
          >
            <option value="local">{{ t('rag.backendLocal') }}</option>
            <option value="ollama">{{ t('rag.backendOllama') }}</option>
          </select>
        </div>
      </div>

      <div v-if="ragStore.embedBackend === 'ollama'">
        <UiLabel class="mb-1.5 block">{{ t('rag.ollamaModel') }}</UiLabel>
        <UiInput
          :model-value="ragStore.ollamaModel"
          placeholder="nomic-embed-text"
          @update:model-value="ragStore.ollamaModel = String($event)"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <input
          ref="fileInput"
          type="file"
          accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
          class="hidden"
          @change="onFileSelected"
        >
        <UiButton
          size="sm"
          variant="outline"
          :disabled="ragStore.busy"
          @click="fileInput?.click()"
        >
          <Upload class="h-4 w-4" />
          {{ t('rag.upload') }}
        </UiButton>
        <UiButton
          size="sm"
          variant="outline"
          :disabled="!ragStore.documents.length || ragStore.busy"
          @click="ragStore.clearAll()"
        >
          {{ t('rag.clear') }}
        </UiButton>
        <span class="text-xs text-muted-foreground">
          {{ t('rag.chunkCount', { count: ragStore.totalChunks }) }}
        </span>
      </div>

      <p v-if="ragStore.error" class="text-xs text-destructive">
        {{ translateError(ragStore.error) }}
      </p>

      <ul v-if="ragStore.documents.length" class="space-y-2">
        <li
          v-for="doc in ragStore.documents"
          :key="doc.id"
          class="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs"
        >
          <div class="min-w-0">
            <p class="font-medium truncate">{{ doc.name }}</p>
            <p class="text-muted-foreground">
              {{ doc.chunkCount }} chunks · {{ Math.round(doc.sizeBytes / 1024) }} KB
            </p>
          </div>
          <UiButton variant="ghost" size="sm" @click="ragStore.removeDocument(doc.id)">
            <Trash2 class="h-4 w-4" />
          </UiButton>
        </li>
      </ul>

      <div v-if="ragStore.lastHits.length" class="space-y-2 border-t border-border pt-3">
        <h4 class="text-xs font-medium">{{ t('rag.retrieved') }}</h4>
        <p class="text-[11px] text-muted-foreground">
          {{ t('rag.injectedVia', { via: ragStore.lastInjectedVia }) }}
        </p>
        <div
          v-for="(hit, idx) in ragStore.lastHits"
          :key="hit.chunk.id"
          class="rounded-md bg-muted/40 p-2 text-xs space-y-1"
        >
          <p class="font-medium">
            [{{ idx + 1 }}] {{ hit.chunk.documentName }}
            · {{ hit.score.toFixed(3) }}
          </p>
          <p class="text-muted-foreground whitespace-pre-wrap">{{ hit.chunk.text }}</p>
        </div>
      </div>
    </template>
  </UiCard>
</template>
