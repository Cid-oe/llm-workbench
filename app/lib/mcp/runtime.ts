// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { callMcpToolHttp, listMcpToolsHttp } from './httpClient'
import { resolveMcpApiUrl } from './status'
import { McpClientError, type FetchImpl, type McpServerConfig, type McpToolDefinition } from './types'

export interface McpRuntimeOptions {
  fetchImpl?: FetchImpl
  headers?: Record<string, string>
  capabilities?: { stdio: boolean, httpProxy: boolean }
  baseURL?: string
}

function parseArgs(argumentsJson: string): Record<string, unknown> {
  const trimmed = argumentsJson.trim() || '{}'
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new McpClientError('Tool arguments must be a JSON object')
    }
    return parsed as Record<string, unknown>
  }
  catch (error) {
    if (error instanceof McpClientError) throw error
    throw new McpClientError('Tool arguments are not valid JSON')
  }
}

async function proxyJson(
  path: string,
  body: unknown,
  fetchImpl: FetchImpl,
  baseURL: string,
): Promise<unknown> {
  const response = await fetchImpl(resolveMcpApiUrl(path, baseURL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({ message: response.statusText })) as {
    message?: string
    tools?: McpToolDefinition[]
    result?: string
  }
  if (!response.ok) {
    throw new McpClientError(payload.message ?? `MCP proxy ${response.status}`, response.status)
  }
  return payload
}

export async function listMcpTools(
  server: McpServerConfig,
  options: McpRuntimeOptions = {},
): Promise<McpToolDefinition[]> {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseURL = options.baseURL ?? '/'
  const capabilities = options.capabilities ?? { stdio: false, httpProxy: false }

  if (server.transport === 'stdio') {
    if (!capabilities.stdio) {
      throw new McpClientError('stdio MCP is only available in Node/Docker (not GitHub Pages).')
    }
    const payload = await proxyJson('/api/mcp/stdio', {
      action: 'list',
      command: server.command,
      args: server.args ?? [],
    }, fetchImpl, baseURL) as { tools?: McpToolDefinition[] }
    return (payload.tools ?? []).map(tool => ({
      ...tool,
      serverId: server.id,
      serverName: server.name,
    }))
  }

  try {
    return await listMcpToolsHttp({
      url: server.url ?? '',
      headers: options.headers,
      fetchImpl,
      transport: server.transport,
    }, server.id, server.name)
  }
  catch (error) {
    if (!capabilities.httpProxy) throw error
    const payload = await proxyJson('/api/mcp/http', {
      action: 'list',
      transport: server.transport,
      url: server.url,
      headers: options.headers,
    }, fetchImpl, baseURL) as { tools?: McpToolDefinition[] }
    return (payload.tools ?? []).map(tool => ({
      ...tool,
      serverId: server.id,
      serverName: server.name,
    }))
  }
}

export async function callMcpTool(
  server: McpServerConfig,
  toolName: string,
  argumentsJson: string,
  options: McpRuntimeOptions = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseURL = options.baseURL ?? '/'
  const capabilities = options.capabilities ?? { stdio: false, httpProxy: false }
  const args = parseArgs(argumentsJson)

  if (server.transport === 'stdio') {
    if (!capabilities.stdio) {
      throw new McpClientError('stdio MCP is only available in Node/Docker (not GitHub Pages).')
    }
    const payload = await proxyJson('/api/mcp/stdio', {
      action: 'call',
      command: server.command,
      args: server.args ?? [],
      toolName,
      arguments: args,
    }, fetchImpl, baseURL) as { result?: string }
    return payload.result ?? '{}'
  }

  try {
    return await callMcpToolHttp({
      url: server.url ?? '',
      headers: options.headers,
      fetchImpl,
      transport: server.transport,
    }, toolName, args)
  }
  catch (error) {
    if (!capabilities.httpProxy) throw error
    const payload = await proxyJson('/api/mcp/http', {
      action: 'call',
      transport: server.transport,
      url: server.url,
      headers: options.headers,
      toolName,
      arguments: args,
    }, fetchImpl, baseURL) as { result?: string }
    return payload.result ?? '{}'
  }
}
