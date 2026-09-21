// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { defineStore } from 'pinia'
import {
  RAG_DEFAULT_CHUNK_OVERLAP,
  RAG_DEFAULT_CHUNK_SIZE,
  RAG_DEFAULT_TOP_K,
  RAG_MAX_CHUNKS,
  RAG_MAX_DOCUMENTS,
  RagError,
  chunkText,
  embedText,
  injectRagContext,
  rankChunks,
  readDocumentText,
  type RagChunk,
  type RagDocumentMeta,
  type RagEmbedBackend,
  type RagHit,
} from '~/lib/rag'
import type { PromptVariables } from '~/types/llm'

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const useRagStore = defineStore('rag', {
  state: () => ({
    enabled: false,
    documents: [] as RagDocumentMeta[],
    chunks: [] as RagChunk[],
    chunkSize: RAG_DEFAULT_CHUNK_SIZE,
    chunkOverlap: RAG_DEFAULT_CHUNK_OVERLAP,
    topK: RAG_DEFAULT_TOP_K,
    embedBackend: 'local' as RagEmbedBackend,
    ollamaModel: 'nomic-embed-text',
    busy: false,
    error: '' as string,
    lastHits: [] as RagHit[],
    lastContextBlock: '',
    lastInjectedVia: 'none' as 'variable' | 'system' | 'none',
  }),

  getters: {
    totalChunks(state): number {
      return state.chunks.length
    },
  },

  actions: {
    clearError() {
      this.error = ''
    },

    clearAll() {
      this.documents = []
      this.chunks = []
      this.lastHits = []
      this.lastContextBlock = ''
      this.lastInjectedVia = 'none'
      this.error = ''
    },

    removeDocument(documentId: string) {
      this.documents = this.documents.filter(d => d.id !== documentId)
      this.chunks = this.chunks.filter(c => c.documentId !== documentId)
    },

    async addDocument(file: File) {
      this.error = ''
      if (this.documents.length >= RAG_MAX_DOCUMENTS) {
        this.error = 'rag.tooManyDocuments'
        throw new RagError('rag.tooManyDocuments')
      }
      this.busy = true
      try {
        const text = await readDocumentText(file)
        const pieces = chunkText(text, {
          chunkSize: this.chunkSize,
          chunkOverlap: this.chunkOverlap,
        })
        if (!pieces.length) throw new RagError('rag.emptyFile')
        if (this.chunks.length + pieces.length > RAG_MAX_CHUNKS) {
          throw new RagError('rag.tooManyChunks')
        }

        const documentId = createId('doc')
        const providerStore = useProviderStore()
        const newChunks: RagChunk[] = []
        for (let i = 0; i < pieces.length; i++) {
          const piece = pieces[i]!
          const embedding = await embedText(piece, this.embedBackend, {
            ollamaUrl: providerStore.ollamaUrl,
            ollamaModel: this.ollamaModel,
          })
          newChunks.push({
            id: createId('chunk'),
            documentId,
            documentName: file.name,
            index: i,
            text: piece,
            embedding,
          })
        }

        this.documents.push({
          id: documentId,
          name: file.name,
          mime: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          addedAt: new Date().toISOString(),
          chunkCount: newChunks.length,
        })
        this.chunks.push(...newChunks)
      }
      catch (err) {
        const key = err instanceof RagError ? err.message : 'rag.ingestFailed'
        this.error = key
        throw err
      }
      finally {
        this.busy = false
      }
    },

    async retrieveForQuery(query: string): Promise<RagHit[]> {
      if (!this.enabled || !this.chunks.length) {
        this.lastHits = []
        this.lastContextBlock = ''
        this.lastInjectedVia = 'none'
        return []
      }
      const providerStore = useProviderStore()
      const queryEmbedding = await embedText(query.trim() || ' ', this.embedBackend, {
        ollamaUrl: providerStore.ollamaUrl,
        ollamaModel: this.ollamaModel,
      })
      const hits = rankChunks(queryEmbedding, this.chunks, this.topK)
      this.lastHits = hits
      return hits
    },

    async preparePrompts(opts: {
      systemPrompt: string
      userPrompt: string
      variables: PromptVariables
      queryText: string
    }) {
      const hits = await this.retrieveForQuery(opts.queryText)
      const injected = injectRagContext({
        systemPrompt: opts.systemPrompt,
        userPrompt: opts.userPrompt,
        variables: opts.variables,
        hits,
      })
      this.lastContextBlock = injected.contextBlock
      this.lastInjectedVia = injected.injectedVia
      return injected
    },
  },
})
