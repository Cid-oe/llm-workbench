// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import { callMcpToolHttp, listMcpToolsHttp } from '../../app/lib/mcp/httpClient'

function jsonResponse(body: unknown, status = 200, contentType = 'application/json') {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } })
}

describe('mcp http client', () => {
  it('lists tools over streamable HTTP JSON-RPC', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { method?: string, id?: number }
      if (payload.method === 'initialize') {
        return jsonResponse({ jsonrpc: '2.0', id: payload.id, result: { protocolVersion: '2024-11-05' } })
      }
      if (!payload.id) return new Response(null, { status: 204 })
      return jsonResponse({
        jsonrpc: '2.0',
        id: payload.id,
        result: { tools: [{ name: 'echo', description: 'Echo', inputSchema: { type: 'object' } }] },
      })
    })

    const tools = await listMcpToolsHttp({
      url: 'http://127.0.0.1:3001/mcp',
      transport: 'http',
      fetchImpl,
    }, 's1', 'Echo')

    expect(tools[0]?.name).toBe('echo')
    expect(fetchImpl).toHaveBeenCalled()
  })

  it('opens SSE endpoint then calls a tool', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (!init?.method || init.method === 'GET') {
        return new Response('event: endpoint\ndata: /messages\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      }
      const payload = JSON.parse(String(init.body)) as { method?: string, id?: number }
      expect(url).toContain('/messages')
      if (payload.method === 'tools/call') {
        return jsonResponse({ jsonrpc: '2.0', id: payload.id, result: { content: [{ type: 'text', text: 'pong' }] } })
      }
      if (!payload.id) return new Response(null, { status: 204 })
      return jsonResponse({ jsonrpc: '2.0', id: payload.id, result: {} })
    })

    const result = await callMcpToolHttp({
      url: 'http://127.0.0.1:3001/sse',
      transport: 'sse',
      fetchImpl,
    }, 'ping', {})
    expect(result).toContain('pong')
  })
})
