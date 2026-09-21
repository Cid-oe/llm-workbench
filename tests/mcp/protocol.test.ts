// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import {
  buildInitializeRequest,
  buildInitializedNotification,
  buildToolsCallRequest,
  parseJsonRpcResponse,
  parseSseEndpoint,
  parseSseJsonRpc,
  parseToolsListResult,
  stringifyToolResult,
} from '../../app/lib/mcp/protocol'
import { McpClientError } from '../../app/lib/mcp/types'

describe('mcp protocol', () => {
  it('builds initialize and tools/call JSON-RPC payloads', () => {
    expect(buildInitializeRequest(1)).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
    })
    expect(buildInitializedNotification().method).toBe('notifications/initialized')
    expect(buildToolsCallRequest(2, 'sum', { a: 1 }).params).toEqual({
      name: 'sum',
      arguments: { a: 1 },
    })
  })

  it('parses tools/list results and rejects JSON-RPC errors', () => {
    const tools = parseToolsListResult({
      tools: [
        { name: 'read_file', description: 'Read', inputSchema: { type: 'object' } },
        { name: '  ' },
        { notATool: true },
      ],
    }, 'srv', 'Files')
    expect(tools).toEqual([{
      name: 'read_file',
      description: 'Read',
      inputSchema: { type: 'object' },
      serverId: 'srv',
      serverName: 'Files',
    }])

    expect(() => parseJsonRpcResponse({ jsonrpc: '2.0', error: { code: -1, message: 'nope' } }))
      .toThrow(McpClientError)
    expect(() => parseJsonRpcResponse('x')).toThrow(/not a JSON-RPC/)
  })

  it('parses SSE endpoint + JSON-RPC data frames', () => {
    const endpoint = parseSseEndpoint('event: endpoint\ndata: /messages?sid=1\n\n', 'http://127.0.0.1:3001/sse')
    expect(endpoint).toBe('http://127.0.0.1:3001/messages?sid=1')

    const rpc = parseSseJsonRpc('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n')
    expect(rpc.result).toEqual({ ok: true })
    expect(() => parseSseEndpoint('event: ping\ndata: 1\n', 'http://x')).toThrow(/endpoint/)
  })

  it('stringifies tool results and surfaces isError', () => {
    expect(stringifyToolResult({ content: [{ type: 'text', text: 'hi' }] })).toContain('hi')
    expect(() => stringifyToolResult({ isError: true, content: 'boom' })).toThrow(/boom/)
  })
})
