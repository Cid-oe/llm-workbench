// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import { toProviderToolDefinitions } from '../../app/lib/mcp/providerTools'
import { injectToolsIntoSystemPrompt, matchMcpTool, mergeToolSignatures } from '../../app/lib/mcp/signatures'
import { callMcpTool, listMcpTools } from '../../app/lib/mcp/runtime'
import { probeMcpCapabilities, resolveMcpApiUrl } from '../../app/lib/mcp/status'
import { McpClientError, type McpServerConfig, type McpToolDefinition } from '../../app/lib/mcp/types'

const sample: McpToolDefinition = {
  name: 'lookup',
  description: 'Look up a term',
  inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
  serverId: 's1',
  serverName: 'Search',
}

const httpServer: McpServerConfig = {
  id: 's1',
  name: 'Search',
  enabled: true,
  transport: 'http',
  url: 'http://127.0.0.1:3001/mcp',
}

describe('mcp mapping and runtime', () => {
  it('maps tools to provider payloads and prompt catalogs', () => {
    expect(toProviderToolDefinitions([sample], 'openai')[0]).toMatchObject({
      type: 'function',
      function: { name: 'lookup' },
    })
    expect(toProviderToolDefinitions([sample], 'anthropic')[0]).toMatchObject({ name: 'lookup' })
    expect(JSON.stringify(toProviderToolDefinitions([sample], 'gemini'))).toContain('functionDeclarations')

    const prompt = injectToolsIntoSystemPrompt('You are helpful.', [sample])
    expect(prompt).toContain('Available tools:')
    expect(injectToolsIntoSystemPrompt(prompt, [sample])).toBe(prompt)
    expect(matchMcpTool({ name: 'lookup', argumentsJson: '{}', raw: {} }, [sample])?.serverId).toBe('s1')
    expect(mergeToolSignatures([{ id: 'local', name: 'other' }], [sample])).toHaveLength(2)
  })

  it('probes capabilities and treats Pages 404 as unavailable', async () => {
    expect(resolveMcpApiUrl('/api/mcp/status', '/llm-workbench/')).toBe('/llm-workbench/api/mcp/status')
    const missing = await probeMcpCapabilities(vi.fn(async () => new Response('no', { status: 404 })))
    expect(missing).toEqual({ stdio: false, httpProxy: false })
    const ok = await probeMcpCapabilities(vi.fn(async () =>
      new Response(JSON.stringify({ stdio: true, httpProxy: true }), { status: 200 }),
    ))
    expect(ok.stdio).toBe(true)
  })

  it('blocks stdio when the Node API is missing', async () => {
    await expect(listMcpTools({
      id: 'local',
      name: 'fs',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
    }, { capabilities: { stdio: false, httpProxy: false } })).rejects.toThrow(/GitHub Pages/)
  })

  it('lists HTTP tools and falls back to the Nitro proxy', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/mcp/http')) {
        return new Response(JSON.stringify({
          tools: [{ name: 'proxy_tool', serverId: 'x', serverName: 'x' }],
        }), { status: 200 })
      }
      if (init?.method === 'POST') throw new TypeError('CORS blocked')
      throw new TypeError('offline')
    })

    const tools = await listMcpTools(httpServer, {
      fetchImpl,
      capabilities: { stdio: false, httpProxy: true },
    })
    expect(tools[0]?.name).toBe('proxy_tool')
    expect(tools[0]?.serverId).toBe('s1')
  })

  it('calls HTTP tools directly when CORS works', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? '{}')) as { method?: string, id?: number }
      if (payload.method === 'tools/call') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: payload.id,
          result: { content: [{ type: 'text', text: 'ok' }] },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (!payload.id) return new Response(null, { status: 204 })
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: {} }), { status: 200 })
    })

    const result = await callMcpTool(httpServer, 'lookup', '{"q":"n"}', {
      fetchImpl,
      capabilities: { stdio: false, httpProxy: false },
    })
    expect(result).toContain('ok')
  })

  it('rejects non-object tool arguments', async () => {
    await expect(callMcpTool(httpServer, 'lookup', '[]')).rejects.toBeInstanceOf(McpClientError)
  })
})
