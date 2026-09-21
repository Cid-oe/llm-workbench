// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { cosineSimilarity } from '~/lib/rag/embed'
import type { RagChunk, RagHit } from '~/lib/rag/types'

export function rankChunks(
  queryEmbedding: number[],
  chunks: RagChunk[],
  topK: number,
): RagHit[] {
  const k = Math.max(1, Math.min(50, Math.floor(topK) || 1))
  const scored = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }))
  scored.sort((a, b) => b.score - a.score || a.chunk.index - b.chunk.index)
  return scored.slice(0, Math.min(k, scored.length))
}
