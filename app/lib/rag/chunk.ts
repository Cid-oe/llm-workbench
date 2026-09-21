// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import {
  RAG_DEFAULT_CHUNK_OVERLAP,
  RAG_DEFAULT_CHUNK_SIZE,
  RAG_MAX_CHUNKS,
  type RagChunkOptions,
} from '~/lib/rag/types'

export class RagError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RagError'
  }
}

export function normalizeChunkOptions(opts?: Partial<RagChunkOptions>): RagChunkOptions {
  const chunkSize = Math.max(64, Math.min(4000, Math.floor(opts?.chunkSize ?? RAG_DEFAULT_CHUNK_SIZE)))
  let chunkOverlap = Math.max(0, Math.min(chunkSize - 1, Math.floor(opts?.chunkOverlap ?? RAG_DEFAULT_CHUNK_OVERLAP)))
  if (chunkOverlap >= chunkSize) chunkOverlap = Math.max(0, chunkSize - 1)
  return { chunkSize, chunkOverlap }
}

/** Split text into overlapping character windows (word-boundary aware when possible). */
export function chunkText(text: string, opts?: Partial<RagChunkOptions>): string[] {
  const { chunkSize, chunkOverlap } = normalizeChunkOptions(opts)
  const cleaned = text.replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []

  const chunks: string[] = []
  let start = 0
  while (start < cleaned.length && chunks.length < RAG_MAX_CHUNKS) {
    let end = Math.min(cleaned.length, start + chunkSize)
    if (end < cleaned.length) {
      const slice = cleaned.slice(start, end)
      const lastSpace = slice.lastIndexOf(' ')
      const lastBreak = slice.lastIndexOf('\n')
      const boundary = Math.max(lastSpace, lastBreak)
      if (boundary > chunkSize * 0.4) end = start + boundary
    }
    const piece = cleaned.slice(start, end).trim()
    if (piece) chunks.push(piece)
    if (end >= cleaned.length) break
    const next = end - chunkOverlap
    start = next <= start ? end : next
  }
  return chunks
}
