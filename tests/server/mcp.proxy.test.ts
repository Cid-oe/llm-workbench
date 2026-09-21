// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadHandler, stubNitroGlobals } from './nitroTestUtils'
import { installOfflineFetchGuard } from '../offlineFetch'

describe('server/api/mcp/status.get', () => {
  beforeEach(() => {
    vi.resetModules()
    stubNitroGlobals()
  })

  it('advertises stdio and HTTP proxy', async () => {
    const handler = await loadHandler('../../server/api/mcp/status.get')
    expect(handler({})).toEqual({ stdio: true, httpProxy: true })
  })
})

describe('server/api/mcp/stdio.post', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    installOfflineFetchGuard()
  })

  afterEach(() => {
    vi.doUnmock('../../server/lib/mcpStdio')
  })

  it('rejects unknown commands with 400 and does not spawn', async () => {
    const runStdioSession = vi.fn()
    vi.doMock('../../server/lib/mcpStdio', () => ({ runStdioSession }))
    stubNitroGlobals({ body: { action: 'list', command: 'bash' } })
    const handler = await loadHandler('../../server/api/mcp/stdio.post')
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
    expect(runStdioSession).not.toHaveBeenCalled()
  })

  it('returns tools from the stdio bridge', async () => {
    vi.doMock('../../server/lib/mcpStdio', () => ({
      runStdioSession: vi.fn(async () => ({ tools: [{ name: 'read_file' }] })),
    }))
    stubNitroGlobals({ body: { action: 'list', command: 'npx', args: ['-y', 'pkg'] } })
    const handler = await loadHandler('../../server/api/mcp/stdio.post')
    await expect(handler({})).resolves.toEqual({ tools: [{ name: 'read_file' }] })
  })
})

describe('server/api/mcp/http.post', () => {
  beforeEach(() => {
    vi.resetModules()
    installOfflineFetchGuard()
  })

  it('rejects invalid URLs with 400', async () => {
    stubNitroGlobals({ body: { action: 'list', transport: 'http', url: 'notaurl' } })
    const handler = await loadHandler('../../server/api/mcp/http.post')
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('proxies tools/list over HTTP', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as { method?: string, id?: number }
      if (payload.method === 'tools/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: payload.id,
          result: { tools: [{ name: 'echo' }] },
        }), { status: 200 })
      }
      if (!payload.id) return new Response(null, { status: 204 })
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: {} }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    stubNitroGlobals({
      body: { action: 'list', transport: 'http', url: 'http://127.0.0.1:3001/mcp' },
    })
    const handler = await loadHandler('../../server/api/mcp/http.post')
    const result = await handler({}) as { tools: Array<{ name: string }> }
    expect(result.tools[0]?.name).toBe('echo')
  })
})
