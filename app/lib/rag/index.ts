// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

export {
  RAG_MAX_FILE_BYTES,
  RAG_MAX_DOCUMENTS,
  RAG_MAX_CHUNKS,
  RAG_DEFAULT_CHUNK_SIZE,
  RAG_DEFAULT_CHUNK_OVERLAP,
  RAG_DEFAULT_TOP_K,
  RAG_EMBEDDING_DIM,
} from '~/lib/rag/types'
export type {
  RagChunk,
  RagChunkOptions,
  RagDocumentMeta,
  RagEmbedBackend,
  RagHit,
  RagRetrieveOptions,
} from '~/lib/rag/types'

export { RagError, chunkText, normalizeChunkOptions } from '~/lib/rag/chunk'
export { detectDocumentKind, extractPdfText, readDocumentText } from '~/lib/rag/parse'
export { cosineSimilarity, embedLocal, embedText, tokenize } from '~/lib/rag/embed'
export { rankChunks } from '~/lib/rag/rank'
export { RAG_CONTEXT_VAR, formatRetrievedContext, injectRagContext } from '~/lib/rag/inject'
