// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { findMajorDrift, formatReport } from '../scripts/check-dependency-drift.mjs'

describe('dependency freshness gate', () => {
  it('allows patch, minor, and one-major drift', () => {
    const drift = findMajorDrift({
      patch: { current: '1.2.3', latest: '1.2.8' },
      minor: { current: '1.2.3', latest: '1.9.0' },
      oneMajor: { current: '1.2.3', latest: '2.4.0' },
    })

    expect(drift).toEqual([])
  })

  it('fails dependencies more than one major behind', () => {
    const outdated = {
      old: { current: '1.4.2', latest: '3.0.0' },
      prerelease: { current: 'v2.1.0', latest: '4.0.0-beta.1' },
    }

    const drift = findMajorDrift(outdated)

    expect(drift).toEqual([
      { name: 'old', current: '1.4.2', latest: '3.0.0' },
      { name: 'prerelease', current: 'v2.1.0', latest: '4.0.0-beta.1' },
    ])
    expect(formatReport(outdated, drift)).toContain('Major drift gate: FAIL')
  })

  it('ignores entries without comparable numeric versions', () => {
    expect(findMajorDrift({ unknown: { current: 'git', latest: 'latest' } })).toEqual([])
  })

  it('allows the explicitly pinned TypeScript major lag', () => {
    expect(findMajorDrift({ typescript: { current: '5.9.3', latest: '7.0.2' } })).toEqual([])
    expect(formatReport({}, [])).toContain('Allowlisted major drift: typescript')
  })
})
