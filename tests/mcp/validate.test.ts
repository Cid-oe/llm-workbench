// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { isAllowedStdioCommand } from '../../app/lib/mcp/stdioAllowlist'
import {
  sanitizeMcpHeaders,
  sanitizeMcpServerConfig,
  validateMcpHttpRequest,
  validateMcpStdioRequest,
} from '../../app/lib/mcp/validate'

describe('mcp validate', () => {
  it('allowlists stdio commands and rejects shells', () => {
    expect(isAllowedStdioCommand('npx')).toBe(true)
    expect(isAllowedStdioCommand('C:\\\\Tools\\\\node.exe')).toBe(true)
    expect(isAllowedStdioCommand('bash')).toBe(false)
    expect(validateMcpStdioRequest({ action: 'list', command: 'bash' }).ok).toBe(false)
  })

  it('accepts list/call stdio bodies and requires toolName on call', () => {
    const listed = validateMcpStdioRequest({
      action: 'list',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
    })
    expect(listed.ok).toBe(true)

    const missing = validateMcpStdioRequest({ action: 'call', command: 'npx' })
    expect(missing.ok).toBe(false)

    const called = validateMcpStdioRequest({
      action: 'call',
      command: 'npx',
      toolName: 'read_file',
      arguments: { path: 'README.md' },
    })
    expect(called.ok).toBe(true)
  })

  it('rejects bad env and non-allowlisted headers', () => {
    expect(validateMcpStdioRequest({ action: 'list', command: 'npx', env: [] }).ok).toBe(false)
    expect(() => sanitizeMcpHeaders({ Cookie: 'a' })).toThrow(/not allowlisted/)
    expect(sanitizeMcpHeaders({ Authorization: 'Bearer x' }).Authorization).toBe('Bearer x')
  })

  it('validates HTTP proxy URLs and sanitizes persisted servers', () => {
    expect(validateMcpHttpRequest({ action: 'list', transport: 'http', url: 'not-a-url' }).ok).toBe(false)
    const ok = validateMcpHttpRequest({
      action: 'call',
      transport: 'sse',
      url: 'http://127.0.0.1:3001/mcp',
      toolName: 'search',
      headers: { Authorization: 'Bearer t' },
    })
    expect(ok.ok).toBe(true)

    expect(sanitizeMcpServerConfig({
      id: '1',
      name: 'fs',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'pkg'],
      authHeader: 'secret',
    })).toMatchObject({ command: 'npx', transport: 'stdio' })
    expect(sanitizeMcpServerConfig({ id: '1', name: 'bad', transport: 'stdio', command: 'rm' })).toBeNull()
    expect(sanitizeMcpServerConfig({ id: '1', name: 'web', transport: 'http', url: 'ftp://x' })).toBeNull()
  })
})
