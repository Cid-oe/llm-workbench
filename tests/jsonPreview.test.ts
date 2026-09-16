import { describe, expect, it } from 'vitest'
import {
  extractJsonCandidate,
  looksLikeJson,
  parseJsonPreview,
} from '../app/lib/jsonPreview'

describe('jsonPreview', () => {
  it('extracts fenced JSON and detects candidates', () => {
    const fenced = 'Here:\n```json\n{"a":1}\n```\n'
    expect(extractJsonCandidate(fenced)).toBe('{"a":1}')
    expect(looksLikeJson(fenced)).toBe(true)
    expect(looksLikeJson('plain text')).toBe(false)
  })

  it('parses valid JSON into a foldable tree and pretty text', () => {
    const result = parseJsonPreview('{"name":"lookup","arguments":{"q":"hi"}}')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pretty).toContain('"name": "lookup"')
    expect(result.tree.kind).toBe('object')
    expect(result.label).toMatch(/tool/i)
  })

  it('returns a clear error for invalid JSON without throwing', () => {
    const result = parseJsonPreview('{"broken":')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.length).toBeGreaterThan(0)
  })
})
