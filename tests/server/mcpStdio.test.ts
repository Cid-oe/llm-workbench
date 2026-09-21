// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import { runStdioSession } from '../../server/lib/mcpStdio'

describe('server/lib/mcpStdio', () => {
  it('lists and calls tools through an injected SDK bridge', async () => {
    const close = vi.fn()
    const listed = await runStdioSession(
      { action: 'list', command: 'npx', args: [], env: {} },
      async () => ({
        listTools: async () => [{ name: 'sum', inputSchema: { type: 'object' } }],
        callTool: async () => ({ content: [] }),
        close,
      }),
    )
    expect(listed.tools?.[0]?.name).toBe('sum')
    expect(close).toHaveBeenCalled()

    const called = await runStdioSession(
      { action: 'call', command: 'npx', args: [], env: {}, toolName: 'sum', arguments: { a: 1 } },
      async () => ({
        listTools: async () => [],
        callTool: async (name, args) => ({ name, args }),
        close,
      }),
    )
    expect(called.result).toContain('sum')
  })
})
