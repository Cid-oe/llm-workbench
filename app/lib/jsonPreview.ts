// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

export type JsonPreviewNode
  = | { kind: 'primitive'; key?: string; value: string; type: 'string' | 'number' | 'boolean' | 'null' }
    | { kind: 'object'; key?: string; children: JsonPreviewNode[]; collapsed?: boolean }
    | { kind: 'array'; key?: string; children: JsonPreviewNode[]; collapsed?: boolean }

export interface JsonParseSuccess {
  ok: true
  value: unknown
  pretty: string
  tree: JsonPreviewNode
  label?: string
}

export interface JsonParseFailure {
  ok: false
  error: string
}

export type JsonParseResult = JsonParseSuccess | JsonParseFailure

const FENCE_RE = /```(?:json|JSON)?\s*([\s\S]*?)```/m

/** Strip a leading/trailing markdown JSON fence if present. */
export function extractJsonCandidate(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(FENCE_RE)
  if (fenced?.[1]) return fenced[1].trim()
  return trimmed
}

export function looksLikeJson(text: string): boolean {
  const candidate = extractJsonCandidate(text)
  if (!candidate) return false
  const start = candidate[0]
  return start === '{' || start === '['
}

function labelToolShape(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (Array.isArray(record.tool_calls)) return 'OpenAI-style tool_calls'
  if (typeof record.name === 'string' && ('arguments' in record || 'parameters' in record)) {
    return 'Tool call payload'
  }
  if (typeof record.tool === 'string' || typeof record.function === 'string') {
    return 'Tool-oriented JSON'
  }
  return undefined
}

function toTree(value: unknown, key?: string): JsonPreviewNode {
  if (value === null) {
    return { kind: 'primitive', key, value: 'null', type: 'null' }
  }
  if (typeof value === 'string') {
    return { kind: 'primitive', key, value: JSON.stringify(value), type: 'string' }
  }
  if (typeof value === 'number') {
    return { kind: 'primitive', key, value: String(value), type: 'number' }
  }
  if (typeof value === 'boolean') {
    return { kind: 'primitive', key, value: String(value), type: 'boolean' }
  }
  if (Array.isArray(value)) {
    return {
      kind: 'array',
      key,
      children: value.map((child, index) => toTree(child, String(index))),
    }
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return {
      kind: 'object',
      key,
      children: entries.map(([childKey, child]) => toTree(child, childKey)),
    }
  }
  return { kind: 'primitive', key, value: String(value), type: 'string' }
}

export function parseJsonPreview(text: string): JsonParseResult {
  const candidate = extractJsonCandidate(text)
  try {
    const value = JSON.parse(candidate) as unknown
    return {
      ok: true,
      value,
      pretty: JSON.stringify(value, null, 2),
      tree: toTree(value),
      label: labelToolShape(value),
    }
  }
  catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid JSON'
    return { ok: false, error: message }
  }
}
