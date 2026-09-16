import type { ProviderId, StreamRequest } from '~/types/llm'
import { resolveGenerationParams } from '~/lib/generation'

export const PROVIDER_IDS = ['openai', 'anthropic', 'gemini', 'groq', 'ollama', 'lmstudio'] as const

export type ValidationResult =
  | { ok: true, value: StreamRequest }
  | { ok: false, error: string }

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)
}

export function isAllowedUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }
  catch {
    return false
  }
}

function optionalFiniteNumber(value: unknown, field: string): { ok: true, value?: number } | { ok: false, error: string } {
  if (value === undefined) return { ok: true }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: `${field} must be a finite number` }
  }
  return { ok: true, value }
}

export function validateStreamRequest(body: unknown): ValidationResult {
  if (body === null || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be an object' }
  }

  const input = body as Record<string, unknown>

  if (!isProviderId(input.provider)) {
    return { ok: false, error: 'Invalid or missing provider' }
  }

  if (typeof input.model !== 'string' || input.model.trim().length === 0) {
    return { ok: false, error: 'Missing model' }
  }

  if (typeof input.systemPrompt !== 'string') {
    return { ok: false, error: 'systemPrompt must be a string' }
  }

  if (typeof input.userPrompt !== 'string') {
    return { ok: false, error: 'userPrompt must be a string' }
  }

  if (input.apiKey !== undefined && typeof input.apiKey !== 'string') {
    return { ok: false, error: 'apiKey must be a string' }
  }

  if (input.ollamaUrl !== undefined) {
    if (typeof input.ollamaUrl !== 'string' || !isAllowedUrl(input.ollamaUrl)) {
      return { ok: false, error: 'Invalid ollamaUrl' }
    }
  }

  if (input.lmStudioUrl !== undefined) {
    if (typeof input.lmStudioUrl !== 'string' || !isAllowedUrl(input.lmStudioUrl)) {
      return { ok: false, error: 'Invalid lmStudioUrl' }
    }
  }

  const temperatureResult = optionalFiniteNumber(input.temperature, 'temperature')
  if (!temperatureResult.ok) return temperatureResult

  const maxTokensResult = optionalFiniteNumber(input.maxTokens, 'maxTokens')
  if (!maxTokensResult.ok) return maxTokensResult

  const generation = resolveGenerationParams({
    temperature: temperatureResult.value,
    maxTokens: maxTokensResult.value,
  })

  return {
    ok: true,
    value: {
      provider: input.provider,
      model: input.model.trim(),
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      apiKey: typeof input.apiKey === 'string' ? input.apiKey : undefined,
      ollamaUrl: typeof input.ollamaUrl === 'string' ? input.ollamaUrl : undefined,
      lmStudioUrl: typeof input.lmStudioUrl === 'string' ? input.lmStudioUrl : undefined,
      temperature: generation.temperature,
      maxTokens: generation.maxTokens,
    },
  }
}
