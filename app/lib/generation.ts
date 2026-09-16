export const DEFAULT_TEMPERATURE = 0.7
export const DEFAULT_MAX_TOKENS = 4096
export const TEMPERATURE_MIN = 0
export const TEMPERATURE_MAX = 2
export const MAX_TOKENS_MIN = 1
export const MAX_TOKENS_MAX = 128_000

export interface ResolvedGeneration {
  temperature: number
  maxTokens: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Resolve sampling params with workbench defaults and safe bounds. */
export function resolveGenerationParams(input?: {
  temperature?: number
  maxTokens?: number
} | null): ResolvedGeneration {
  const temperature = typeof input?.temperature === 'number' && Number.isFinite(input.temperature)
    ? clamp(input.temperature, TEMPERATURE_MIN, TEMPERATURE_MAX)
    : DEFAULT_TEMPERATURE
  const maxTokens = typeof input?.maxTokens === 'number' && Number.isFinite(input.maxTokens)
    ? Math.round(clamp(input.maxTokens, MAX_TOKENS_MIN, MAX_TOKENS_MAX))
    : DEFAULT_MAX_TOKENS
  return { temperature, maxTokens }
}
