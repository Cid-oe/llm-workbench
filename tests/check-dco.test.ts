// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { findMissingDco, hasSignedOffBy } from '../scripts/check-dco.mjs'

describe('DCO checker', () => {
  it('accepts a Signed-off-by trailer', () => {
    expect(hasSignedOffBy('feat: x\n\nSigned-off-by: Ada <ada@example.com>\n')).toBe(true)
  })

  it('rejects commits without a trailer', () => {
    const log = 'feat: no trailer\n\nbody only\0fix: also missing\n'
    expect(findMissingDco(log)).toEqual(['feat: no trailer', 'fix: also missing'])
  })

  it('skips merge commits', () => {
    expect(findMissingDco('Merge pull request #1 from fork\n\nno trailer\0')).toEqual([])
  })
})
