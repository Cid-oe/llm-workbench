import { describe, expect, it } from 'vitest'
import {
  evaluateAssertion,
  evaluateAssertions,
  summarizeAssertionResults,
  validateJsonSchema,
} from '../app/lib/assertions'

describe('assertions', () => {
  it('validates JSON and rejects invalid bodies', () => {
    expect(evaluateAssertion({ id: '1', kind: 'jsonValid' }, '{"ok":true}').pass).toBe(true)
    expect(evaluateAssertion({ id: '1', kind: 'jsonValid' }, '{broken').pass).toBe(false)
  })

  it('validates a minimal JSON Schema', () => {
    const schema = JSON.stringify({
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' } },
    })
    expect(evaluateAssertion(
      { id: 's', kind: 'jsonSchema', schemaJson: schema },
      '{"name":"ada"}',
    ).pass).toBe(true)
    expect(evaluateAssertion(
      { id: 's', kind: 'jsonSchema', schemaJson: schema },
      '{"name":1}',
    ).pass).toBe(false)
    expect(validateJsonSchema({ name: 'x' }, { type: 'object', required: ['name'] })).toBeNull()
  })

  it('flags forbidden substrings', () => {
    const rule = { id: 'f', kind: 'forbiddenSubstring' as const, substring: 'Lo siento' }
    expect(evaluateAssertion(rule, 'All good').pass).toBe(true)
    expect(evaluateAssertion(rule, 'Lo siento, no puedo').pass).toBe(false)
  })

  it('enforces length limits for characters, words, and tokens', () => {
    expect(evaluateAssertion(
      { id: 'l', kind: 'length', unit: 'characters', max: 5 },
      'abcdef',
    ).pass).toBe(false)
    expect(evaluateAssertion(
      { id: 'l', kind: 'length', unit: 'words', min: 2, max: 4 },
      'one two three',
    ).pass).toBe(true)
    expect(evaluateAssertion(
      { id: 'l', kind: 'length', unit: 'tokens', max: 1 },
      'abcdefghij',
    ).pass).toBe(false)
  })

  it('summarizes mixed results as fail', () => {
    const results = evaluateAssertions(
      [
        { id: '1', kind: 'jsonValid' },
        { id: '2', kind: 'forbiddenSubstring', substring: 'nope' },
      ],
      '{"ok":true}',
    )
    expect(summarizeAssertionResults(results)).toBe('pass')
    expect(summarizeAssertionResults([
      ...results,
      { ruleId: 'x', kind: 'jsonValid', pass: false, message: 'bad' },
    ])).toBe('fail')
  })
})
