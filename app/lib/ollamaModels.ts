// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { ProviderModel } from '~/types/llm'
import { PROVIDER_MODELS } from '~/lib/providerModels'
import { corsHint } from '~/lib/streamProviders'

export interface OllamaDiscoverResult {
  models: ProviderModel[]
  source: 'live' | 'fallback'
  error?: string
}

export function staticOllamaModels(): ProviderModel[] {
  return PROVIDER_MODELS.filter(m => m.provider === 'ollama')
}

export function ollamaModelFromName(name: string): ProviderModel {
  const id = name.trim()
  return {
    id,
    label: `${id} (Ollama)`,
    provider: 'ollama',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
  }
}

/** Parse Ollama `/api/tags` JSON into workbench model entries. */
export function parseOllamaTags(payload: unknown): ProviderModel[] {
  if (!payload || typeof payload !== 'object') return []
  const modelsRaw = (payload as { models?: unknown }).models
  if (!Array.isArray(modelsRaw)) return []

  const seen = new Set<string>()
  const models: ProviderModel[] = []
  for (const entry of modelsRaw) {
    if (!entry || typeof entry !== 'object') continue
    const name = (entry as { name?: unknown, model?: unknown }).name
      ?? (entry as { model?: unknown }).model
    if (typeof name !== 'string' || !name.trim()) continue
    const id = name.trim()
    if (seen.has(id)) continue
    seen.add(id)
    models.push(ollamaModelFromName(id))
  }
  return models
}

export function ollamaTagsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  return `${trimmed}/api/tags`
}

/**
 * Fetch local Ollama models from `/api/tags`.
 * On network/HTTP/parse failure, returns the static catalog and a friendly error.
 */
export async function discoverOllamaModels(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OllamaDiscoverResult> {
  const fallback = staticOllamaModels()
  const url = ollamaTagsUrl(baseUrl || 'http://localhost:11434')

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      return {
        models: fallback,
        source: 'fallback',
        error: `Ollama returned HTTP ${response.status} for ${url}. Showing built-in list.`,
      }
    }

    const payload: unknown = await response.json()
    const models = parseOllamaTags(payload)
    if (!models.length) {
      return {
        models: fallback,
        source: 'fallback',
        error: 'No models found on Ollama. Showing built-in list. Try `ollama pull llama3.2`.',
      }
    }

    return { models, source: 'live' }
  }
  catch {
    return {
      models: fallback,
      source: 'fallback',
      error: `Could not reach Ollama at ${url}. ${corsHint('ollama')} Showing built-in list.`,
    }
  }
}
