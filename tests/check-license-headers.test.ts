import { describe, expect, it } from 'vitest'
import {
  applyHeader,
  hasRequiredHeaders,
  headerFor,
} from '../scripts/check-license-headers.mjs'

describe('license header checker', () => {
  it('detects copyright year and SPDX MIT', () => {
    const ok = '// Copyright (c) 2026 llm-workbench contributors\n// SPDX-License-Identifier: MIT\n'
    expect(hasRequiredHeaders(ok)).toBe(true)
    expect(hasRequiredHeaders('// SPDX-License-Identifier: MIT\n')).toBe(false)
    expect(hasRequiredHeaders('// Copyright (c) 2026 x\n')).toBe(false)
  })

  it('builds language-specific headers', () => {
    expect(headerFor('.ts')).toContain('SPDX-License-Identifier: MIT')
    expect(headerFor('.vue')).toMatch(/^<!-- /)
    expect(headerFor('.css')).toContain('/* ')
  })

  it('inserts a header after a shebang and skips files that already have one', () => {
    const withShebang = applyHeader('#!/usr/bin/env node\nconsole.log(1)\n', '.mjs')
    expect(withShebang.startsWith('#!/usr/bin/env node\n')).toBe(true)
    expect(hasRequiredHeaders(withShebang)).toBe(true)

    const already = '// Copyright (c) 2026 x\n// SPDX-License-Identifier: MIT\nexport {}\n'
    expect(applyHeader(already, '.ts')).toBe(already)
  })
})
