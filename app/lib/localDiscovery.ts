// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { ProviderModel } from '~/types/llm'
import { discoverOllamaModels, type OllamaDiscoverResult } from '~/lib/ollamaModels'
import { corsHint } from '~/lib/streamProviders'

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_LM_STUDIO_URL = 'http://localhost:1234'

export type LocalBackend = 'ollama' | 'lmstudio'

export interface LocalProbeResult {
  backend: LocalBackend
  ok: boolean
  baseUrl: string
  models: ProviderModel[]
  error?: string
}

export interface LocalDiscoveryResult {
  probes: LocalProbeResult[]
  /** First successful backend, if any */
  primary?: LocalProbeResult
}

export const CLOUD_PROVIDERS = ['openai', 'anthropic', 'gemini', 'groq'] as const

export function isCloudProvider(provider: string): boolean {
  return (CLOUD_PROVIDERS as readonly string[]).includes(provider)
}

export function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1'
      || parsed.hostname === '[::1]'
      || parsed.hostname === '::1'
  }
  catch {
    return false
  }
}

export function assertAirGappedUrl(url: string, airGapped: boolean): void {
  if (!airGapped) return
  if (!isLocalhostUrl(url)) {
    throw new Error('Air-gapped mode blocks non-localhost endpoints')
  }
}

export function lmStudioModelsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  return `${trimmed}/v1/models`
}

export function lmStudioModelFromId(id: string): ProviderModel {
  const modelId = id.trim()
  return {
    id: modelId,
    label: `${modelId} (LM Studio)`,
    provider: 'lmstudio',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
  }
}

/** Parse OpenAI-compatible `/v1/models` list (LM Studio). */
export function parseOpenAiModelList(payload: unknown): ProviderModel[] {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  const seen = new Set<string>()
  const models: ProviderModel[] = []
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue
    const id = (entry as { id?: unknown }).id
    if (typeof id !== 'string' || !id.trim()) continue
    const modelId = id.trim()
    if (seen.has(modelId)) continue
    seen.add(modelId)
    models.push(lmStudioModelFromId(modelId))
  }
  return models
}

export async function discoverLmStudioModels(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OllamaDiscoverResult> {
  const url = lmStudioModelsUrl(baseUrl || DEFAULT_LM_STUDIO_URL)
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      return {
        models: [],
        source: 'fallback',
        error: `LM Studio returned HTTP ${response.status} for ${url}.`,
      }
    }
    const payload: unknown = await response.json()
    const models = parseOpenAiModelList(payload)
    if (!models.length) {
      return {
        models: [],
        source: 'fallback',
        error: `LM Studio at ${url} returned no models. Load a model in LM Studio first.`,
      }
    }
    return { models, source: 'live' }
  }
  catch {
    return {
      models: [],
      source: 'fallback',
      error: `Could not reach LM Studio at ${url}. ${corsHint('lmstudio')}`,
    }
  }
}

export async function discoverLocalLlms(
  options: {
    ollamaUrl?: string
    lmStudioUrl?: string
    fetchImpl?: typeof fetch
  } = {},
): Promise<LocalDiscoveryResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const ollamaUrl = options.ollamaUrl?.trim() || DEFAULT_OLLAMA_URL
  const lmStudioUrl = options.lmStudioUrl?.trim() || DEFAULT_LM_STUDIO_URL

  const [ollama, lmstudio] = await Promise.all([
    discoverOllamaModels(ollamaUrl, fetchImpl),
    discoverLmStudioModels(lmStudioUrl, fetchImpl),
  ])

  const probes: LocalProbeResult[] = [
    {
      backend: 'ollama',
      ok: ollama.source === 'live',
      baseUrl: ollamaUrl,
      models: ollama.models,
      error: ollama.error,
    },
    {
      backend: 'lmstudio',
      ok: lmstudio.source === 'live',
      baseUrl: lmStudioUrl,
      models: lmstudio.models,
      error: lmstudio.error,
    },
  ]

  return {
    probes,
    primary: probes.find(p => p.ok),
  }
}
