// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { RAG_EMBEDDING_DIM } from '~/lib/rag/types'
import { RagError } from '~/lib/rag/chunk'

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Deterministic local embedding (hashed bag-of-words). No network, offline-safe. */
export function embedLocal(text: string, dim = RAG_EMBEDDING_DIM): number[] {
  const vec = new Array<number>(dim).fill(0)
  const tokens = tokenize(text)
  if (!tokens.length) return vec

  for (const token of tokens) {
    const h = hashToken(token)
    const idx = h % dim
    const sign = (h & 1) === 0 ? 1 : -1
    vec[idx]! += sign
  }
  return l2Normalize(vec)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (!n) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export async function embedText(
  text: string,
  backend: 'local' | 'ollama',
  options?: {
    ollamaUrl?: string
    ollamaModel?: string
    fetchImpl?: typeof fetch
  },
): Promise<number[]> {
  if (backend === 'local') return embedLocal(text)
  return embedOllama(text, options)
}

async function embedOllama(
  text: string,
  options?: {
    ollamaUrl?: string
    ollamaModel?: string
    fetchImpl?: typeof fetch
  },
): Promise<number[]> {
  const base = (options?.ollamaUrl ?? 'http://localhost:11434').replace(/\/$/, '')
  const model = options?.ollamaModel?.trim() || 'nomic-embed-text'
  const fetchImpl = options?.fetchImpl ?? fetch
  let response: Response
  try {
    response = await fetchImpl(`${base}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    })
  }
  catch {
    throw new RagError('rag.ollamaUnreachable')
  }
  if (!response.ok) throw new RagError('rag.ollamaEmbedFailed')
  const json = await response.json() as { embedding?: unknown }
  if (!Array.isArray(json.embedding) || !json.embedding.every(n => typeof n === 'number')) {
    throw new RagError('rag.ollamaEmbedFailed')
  }
  return l2Normalize(json.embedding as number[])
}

function hashToken(token: string): number {
  let h = 2166136261
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function l2Normalize(vec: number[]): number[] {
  let sum = 0
  for (const v of vec) sum += v * v
  if (sum === 0) return vec
  const norm = Math.sqrt(sum)
  return vec.map(v => v / norm)
}
