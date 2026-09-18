import * as v from 'valibot'
import type { GenerationParams, PromptFileData, PromptVariables, ProviderId } from '~/types/llm'
import { isSecretFrontmatterKey } from '~/lib/promptSecrets'

const PROMPT_FILE_PROVIDERS = ['openai', 'anthropic', 'gemini', 'groq', 'ollama'] as const

const optionalString = v.pipe(
  v.unknown(),
  v.transform((value): string | undefined => {
    if (typeof value === 'string' && value) return value
    if (typeof value === 'number') return String(value)
    return undefined
  }),
)

const optionalFiniteNumber = v.pipe(
  v.unknown(),
  v.transform((value): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value)
    return undefined
  }),
)

const stringList = v.pipe(
  v.unknown(),
  v.transform((value): string[] => {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  }),
)

const providerField = v.pipe(
  v.unknown(),
  v.transform((value): ProviderId | undefined => {
    if (typeof value !== 'string') return undefined
    return (PROMPT_FILE_PROVIDERS as readonly string[]).includes(value)
      ? value as ProviderId
      : undefined
  }),
)

const variablesField = v.pipe(
  v.unknown(),
  v.transform((value): PromptVariables => {
    if (value == null) return {}
    if (Array.isArray(value)) {
      const vars: PromptVariables = {}
      for (const item of value) {
        if (typeof item === 'string' && item) vars[item] = ''
      }
      return vars
    }
    if (typeof value === 'object') {
      const vars: PromptVariables = {}
      for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        if (isSecretFrontmatterKey(key)) continue
        vars[key] = raw == null ? '' : String(raw)
      }
      return vars
    }
    return {}
  }),
)

/**
 * Validates/normalizes parsed YAML frontmatter + body sections.
 * Secret keys are stripped before this schema runs.
 */
export const promptFileDataSchema = v.pipe(
  v.object({
    name: v.optional(v.unknown()),
    tags: v.optional(v.unknown()),
    model: v.optional(v.unknown()),
    provider: v.optional(v.unknown()),
    temperature: v.optional(v.unknown()),
    top_p: v.optional(v.unknown()),
    topP: v.optional(v.unknown()),
    max_tokens: v.optional(v.unknown()),
    maxTokens: v.optional(v.unknown()),
    variables: v.optional(v.unknown()),
    systemPrompt: v.string(),
    userPrompt: v.string(),
  }),
  v.transform((matter): PromptFileData => {
    const generation: GenerationParams = {}
    const temperature = v.parse(optionalFiniteNumber, matter.temperature)
    const topP = v.parse(optionalFiniteNumber, matter.top_p ?? matter.topP)
    const maxTokens = v.parse(optionalFiniteNumber, matter.max_tokens ?? matter.maxTokens)
    if (temperature !== undefined) generation.temperature = temperature
    if (topP !== undefined) generation.topP = topP
    if (maxTokens !== undefined) generation.maxTokens = maxTokens

    return {
      name: v.parse(optionalString, matter.name),
      tags: v.parse(stringList, matter.tags),
      model: v.parse(optionalString, matter.model),
      provider: v.parse(providerField, matter.provider),
      generation: Object.keys(generation).length ? generation : undefined,
      variables: v.parse(variablesField, matter.variables),
      systemPrompt: matter.systemPrompt,
      userPrompt: matter.userPrompt,
    }
  }),
)

export function firstSchemaIssue(issues: v.BaseIssue<unknown>[]): string {
  return issues[0]?.message ?? 'Invalid prompt file'
}
