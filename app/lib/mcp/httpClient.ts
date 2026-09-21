// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import {
  buildInitializeRequest,
  buildInitializedNotification,
  buildToolsCallRequest,
  buildToolsListRequest,
  parseJsonRpcResponse,
  parseSseEndpoint,
  parseSseJsonRpc,
  parseToolsListResult,
  stringifyToolResult,
} from './protocol'
import {
  McpClientError,
  type FetchImpl,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpToolDefinition,
} from './types'

export interface HttpMcpSessionOptions {
  url: string
  headers?: Record<string, string>
  fetchImpl?: FetchImpl
  transport: 'http' | 'sse'
}

async function readJsonRpcFromResponse(response: Response): Promise<JsonRpcResponse> {
  const contentType = response.headers.get('content-type') ?? ''
  const text = await response.text()
  if (!response.ok) {
    throw new McpClientError(`MCP HTTP ${response.status}`, response.status)
  }
  if (contentType.includes('text/event-stream')) {
    return parseSseJsonRpc(text)
  }
  try {
    return parseJsonRpcResponse(JSON.parse(text) as unknown)
  }
  catch (error) {
    if (error instanceof McpClientError) throw error
    throw new McpClientError('MCP HTTP body is not valid JSON')
  }
}

async function postJsonRpc(
  url: string,
  payload: JsonRpcRequest | JsonRpcNotification,
  headers: Record<string, string>,
  fetchImpl: FetchImpl,
): Promise<JsonRpcResponse | undefined> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  })
  if (!('id' in payload)) {
    if (!response.ok) throw new McpClientError(`MCP HTTP ${response.status}`, response.status)
    return undefined
  }
  return readJsonRpcFromResponse(response)
}

async function openSseMessageUrl(
  url: string,
  headers: Record<string, string>,
  fetchImpl: FetchImpl,
): Promise<string> {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'text/event-stream', ...headers },
  })
  if (!response.ok) throw new McpClientError(`MCP SSE ${response.status}`, response.status)
  const text = await response.text()
  return parseSseEndpoint(text, url)
}

export async function listMcpToolsHttp(
  options: HttpMcpSessionOptions,
  serverId: string,
  serverName: string,
): Promise<McpToolDefinition[]> {
  const fetchImpl = options.fetchImpl ?? fetch
  const headers = { ...options.headers }
  const rpcUrl = options.transport === 'sse'
    ? await openSseMessageUrl(options.url, headers, fetchImpl)
    : options.url

  await postJsonRpc(rpcUrl, buildInitializeRequest(1), headers, fetchImpl)
  await postJsonRpc(rpcUrl, buildInitializedNotification(), headers, fetchImpl)
  const listed = await postJsonRpc(rpcUrl, buildToolsListRequest(2), headers, fetchImpl)
  return parseToolsListResult(listed?.result, serverId, serverName)
}

export async function callMcpToolHttp(
  options: HttpMcpSessionOptions,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch
  const headers = { ...options.headers }
  const rpcUrl = options.transport === 'sse'
    ? await openSseMessageUrl(options.url, headers, fetchImpl)
    : options.url

  await postJsonRpc(rpcUrl, buildInitializeRequest(1), headers, fetchImpl)
  await postJsonRpc(rpcUrl, buildInitializedNotification(), headers, fetchImpl)
  const called = await postJsonRpc(
    rpcUrl,
    buildToolsCallRequest(2, toolName, args),
    headers,
    fetchImpl,
  )
  return stringifyToolResult(called?.result)
}
