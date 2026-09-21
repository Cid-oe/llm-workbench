// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import {
  MCP_CLIENT_INFO,
  MCP_PROTOCOL_VERSION,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpToolDefinition,
  McpClientError,
} from './types'

export function buildInitializeRequest(id: number): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      clientInfo: MCP_CLIENT_INFO,
    },
  }
}

export function buildInitializedNotification(): JsonRpcNotification {
  return { jsonrpc: '2.0', method: 'notifications/initialized' }
}

export function buildToolsListRequest(id: number): JsonRpcRequest {
  return { jsonrpc: '2.0', id, method: 'tools/list', params: {} }
}

export function buildToolsCallRequest(
  id: number,
  name: string,
  args: Record<string, unknown>,
): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  }
}

export function parseJsonRpcResponse(value: unknown): JsonRpcResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new McpClientError('MCP response is not a JSON-RPC object')
  }
  const record = value as Record<string, unknown>
  if (record.jsonrpc !== '2.0') {
    throw new McpClientError('MCP response is missing jsonrpc 2.0')
  }
  const error = record.error
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    const err = error as Record<string, unknown>
    const message = typeof err.message === 'string' ? err.message : 'MCP JSON-RPC error'
    throw new McpClientError(message)
  }
  return record as unknown as JsonRpcResponse
}

export function parseSseJsonRpc(text: string): JsonRpcResponse {
  const payloads: string[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('data:')) payloads.push(trimmed.slice(5).trim())
  }
  const joined = payloads.filter(Boolean).join('\n')
  if (!joined) throw new McpClientError('SSE MCP response had no data payload')
  try {
    return parseJsonRpcResponse(JSON.parse(joined) as unknown)
  }
  catch (error) {
    if (error instanceof McpClientError) throw error
    throw new McpClientError('SSE MCP payload is not valid JSON')
  }
}

export function parseSseEndpoint(text: string, baseUrl: string): string {
  let event = ''
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:') && event === 'endpoint') {
      const data = line.slice(5).trim()
      return new URL(data, baseUrl).href
    }
  }
  throw new McpClientError('SSE MCP handshake did not include an endpoint event')
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function parseToolsListResult(
  result: unknown,
  serverId: string,
  serverName: string,
): McpToolDefinition[] {
  const root = asObject(result)
  const list = Array.isArray(root?.tools) ? root.tools : []
  const tools: McpToolDefinition[] = []
  for (const entry of list) {
    const tool = asObject(entry)
    if (!tool || typeof tool.name !== 'string' || !tool.name.trim()) continue
    const schema = asObject(tool.inputSchema) ?? undefined
    tools.push({
      name: tool.name.trim(),
      description: typeof tool.description === 'string' ? tool.description : undefined,
      inputSchema: schema,
      serverId,
      serverName,
    })
  }
  return tools
}

export function stringifyToolResult(result: unknown): string {
  const root = asObject(result)
  if (root?.isError === true) {
    const message = typeof root.content === 'string'
      ? root.content
      : JSON.stringify(root.content ?? root)
    throw new McpClientError(message)
  }
  try {
    return JSON.stringify(result ?? {}, null, 2)
  }
  catch {
    return '{"ok":true}'
  }
}
