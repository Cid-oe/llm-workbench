import { describe, expect, it } from 'vitest'
import { diffLines, formatPromptForDiff, toSplitDiffRows } from '../app/lib/promptDiff'

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

  it('pairs remove/add hunks into split rows', () => {
    const rows = toSplitDiffRows([
      { kind: 'equal', text: 'same' },
      { kind: 'remove', text: 'old' },
      { kind: 'add', text: 'new' },
      { kind: 'add', text: 'extra' },
    ])
    expect(rows).toEqual([
      { left: { kind: 'equal', text: 'same' }, right: { kind: 'equal', text: 'same' } },
      { left: { kind: 'remove', text: 'old' }, right: { kind: 'add', text: 'new' } },
      { left: null, right: { kind: 'add', text: 'extra' } },
    ])
  })
})
