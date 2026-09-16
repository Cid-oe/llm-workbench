import { describe, expect, it } from 'vitest'
import { diffLines, formatPromptForDiff } from '../app/lib/promptDiff'

describe('promptDiff', () => {
  it('marks added and removed lines', () => {
    const hunks = diffLines('hello\nworld', 'hello\nthere')
    expect(hunks).toEqual([
      { kind: 'equal', text: 'hello' },
      { kind: 'remove', text: 'world' },
      { kind: 'add', text: 'there' },
    ])
  })

  it('formats system and user for a combined drift view', () => {
    expect(formatPromptForDiff('sys', 'user')).toBe('## System\nsys\n\n## User\nuser')
  })
})
