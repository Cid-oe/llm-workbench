// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

/** Soft limits so GitHub Pages stays responsive and uploads stay local. */
export const RAG_MAX_FILE_BYTES = 512 * 1024
export const RAG_MAX_DOCUMENTS = 8
export const RAG_MAX_CHUNKS = 400
export const RAG_DEFAULT_CHUNK_SIZE = 500
export const RAG_DEFAULT_CHUNK_OVERLAP = 50
export const RAG_DEFAULT_TOP_K = 4
export const RAG_EMBEDDING_DIM = 64

export type RagEmbedBackend = 'local' | 'ollama'

export interface RagDocumentMeta {
  id: string
  name: string
  mime: string
  sizeBytes: number
  addedAt: string
  chunkCount: number
}

export interface RagChunk {
  id: string
  documentId: string
  documentName: string
  index: number
  text: string
  embedding: number[]
}

export interface RagHit {
  chunk: RagChunk
  score: number
}

export interface RagChunkOptions {
  chunkSize: number
  chunkOverlap: number
}

export interface RagRetrieveOptions extends RagChunkOptions {
  topK: number
  embedBackend: RagEmbedBackend
  ollamaUrl?: string
  ollamaModel?: string
}
