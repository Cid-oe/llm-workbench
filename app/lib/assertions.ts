import { estimateTokens } from '~/composables/useCostCalculator'
import type {
  AssertionResult,
  AssertionRule,
  AssertionSummary,
  LengthUnit,
} from '~/types/llm'

export type { AssertionRule, AssertionResult, AssertionSummary } from '~/types/llm'
export { createAssertionId }

function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function measure(text: string, unit: LengthUnit): number {
  if (unit === 'words') return wordCount(text)
  if (unit === 'tokens') return estimateTokens(text)
  return text.length
}

function createAssertionId(): string {
  return `assert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Minimal JSON Schema subset: type + required + properties types + array items. */
export function validateJsonSchema(value: unknown, schema: unknown): string | null {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return 'Schema must be a JSON object'
  }
  const s = schema as Record<string, unknown>
  const type = s.type
  if (typeof type === 'string') {
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
    if (type !== actual) return `Expected type ${type}, got ${actual}`
  }
  if (type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    const required = Array.isArray(s.required) ? s.required.filter((k): k is string => typeof k === 'string') : []
    for (const key of required) {
      if (!(key in obj)) return `Missing required property "${key}"`
    }
    const properties = s.properties
    if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
      for (const [key, propSchema] of Object.entries(properties as Record<string, unknown>)) {
        if (key in obj) {
          const nested = validateJsonSchema(obj[key], propSchema)
          if (nested) return `properties.${key}: ${nested}`
        }
      }
    }
  }
  if (type === 'array' && Array.isArray(value) && s.items) {
    for (let i = 0; i < value.length; i++) {
      const nested = validateJsonSchema(value[i], s.items)
      if (nested) return `items[${i}]: ${nested}`
    }
  }
  return null
}

export function evaluateAssertion(rule: AssertionRule, content: string): AssertionResult {
  const base = { ruleId: rule.id, kind: rule.kind }

  if (rule.kind === 'jsonValid' || rule.kind === 'jsonSchema') {
    let parsed: unknown
    try {
      parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
    }
    catch (e) {
      return {
        ...base,
        pass: false,
        message: e instanceof Error ? e.message : 'Invalid JSON',
      }
    }
    if (rule.kind === 'jsonValid') {
      return { ...base, pass: true, message: 'Valid JSON' }
    }
    let schema: unknown
    try {
      schema = JSON.parse(rule.schemaJson?.trim() || '{}')
    }
    catch {
      return { ...base, pass: false, message: 'Assertion schema is not valid JSON' }
    }
    const schemaError = validateJsonSchema(parsed, schema)
    if (schemaError) return { ...base, pass: false, message: schemaError }
    return { ...base, pass: true, message: 'Matches JSON Schema' }
  }

  if (rule.kind === 'forbiddenSubstring') {
    const needle = rule.substring ?? ''
    if (!needle) {
      return { ...base, pass: false, message: 'Forbidden substring is empty' }
    }
    const found = content.includes(needle)
    return {
      ...base,
      pass: !found,
      message: found ? `Contains forbidden text "${needle}"` : `Does not contain "${needle}"`,
    }
  }

  if (rule.kind === 'length') {
    const unit = rule.unit ?? 'characters'
    const size = measure(content, unit)
    if (rule.min != null && size < rule.min) {
      return { ...base, pass: false, message: `${size} ${unit} < min ${rule.min}` }
    }
    if (rule.max != null && size > rule.max) {
      return { ...base, pass: false, message: `${size} ${unit} > max ${rule.max}` }
    }
    return { ...base, pass: true, message: `${size} ${unit} within limits` }
  }

  return { ...base, pass: false, message: 'Unknown assertion kind' }
}

export function evaluateAssertions(rules: AssertionRule[], content: string): AssertionResult[] {
  return rules.filter(r => r.enabled !== false).map(r => evaluateAssertion(r, content))
}

export function summarizeAssertionResults(results: AssertionResult[]): AssertionSummary {
  if (results.length === 0) return 'none'
  return results.every(r => r.pass) ? 'pass' : 'fail'
}

export function summarizeResponses(
  responses: { assertionResults?: AssertionResult[] }[],
): AssertionSummary {
  const all = responses.flatMap(r => r.assertionResults ?? [])
  return summarizeAssertionResults(all)
}
