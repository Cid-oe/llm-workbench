// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import * as v from 'valibot'
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

/** First actionable issue message; never includes raw input (avoids leaking apiKey). */
export function firstSchemaIssue(issues: v.BaseIssue<unknown>[]): string {
  const issue = issues[0]
  if (!issue) return 'Invalid input'
  return issue.message
}

const finiteNumber = (field: string) =>
  v.pipe(
    v.number(`${field} must be a finite number`),
    v.finite(`${field} must be a finite number`),
  )

const httpUrl = (field: string) =>
  v.pipe(
    v.string(`Invalid ${field}`),
    v.check(isAllowedUrl, `Invalid ${field}`),
  )

export const streamRequestSchema = v.pipe(
  v.object(
    {
      provider: v.picklist(PROVIDER_IDS, 'Invalid or missing provider'),
      model: v.pipe(
        v.string('Missing model'),
        v.transform(value => value.trim()),
        v.minLength(1, 'Missing model'),
      ),
      systemPrompt: v.string('systemPrompt must be a string'),
      userPrompt: v.string('userPrompt must be a string'),
      apiKey: v.optional(v.string('apiKey must be a string')),
      ollamaUrl: v.optional(httpUrl('ollamaUrl')),
      lmStudioUrl: v.optional(httpUrl('lmStudioUrl')),
      temperature: v.optional(finiteNumber('temperature')),
      maxTokens: v.optional(finiteNumber('maxTokens')),
    },
    'Request body must be an object',
  ),
  v.transform((input): StreamRequest => {
    const generation = resolveGenerationParams({
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    })
    return {
      provider: input.provider,
      model: input.model,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      apiKey: input.apiKey,
      ollamaUrl: input.ollamaUrl,
      lmStudioUrl: input.lmStudioUrl,
      temperature: generation.temperature,
      maxTokens: generation.maxTokens,
    }
  }),
)

export function validateStreamRequest(body: unknown): ValidationResult {
  const result = v.safeParse(streamRequestSchema, body)
  if (!result.success) {
    return { ok: false, error: firstSchemaIssue(result.issues) }
  }
  return { ok: true, value: result.output }
}
