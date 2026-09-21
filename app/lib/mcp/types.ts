// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

export const MCP_PROTOCOL_VERSION = '2024-11-05'
export const MCP_CLIENT_INFO = { name: 'llm-workbench', version: '0.2.0' } as const

export const MCP_TRANSPORTS = ['http', 'sse', 'stdio'] as const
export type McpTransport = (typeof MCP_TRANSPORTS)[number]

export interface McpServerConfig {
  id: string
  name: string
  enabled: boolean
  transport: McpTransport
  /** HTTP or SSE endpoint. */
  url?: string
  /** stdio executable (allowlisted basename). */
  command?: string
  args?: string[]
}

export interface McpToolDefinition {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  serverId: string
  serverName: string
}

export interface McpToolCallInspection {
  serverId: string
  serverName: string
  toolName: string
  argumentsJson: string
  resultJson: string
  error?: string
  durationMs: number
}

export interface McpCapabilities {
  stdio: boolean
  httpProxy: boolean
}

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: unknown
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

export interface JsonRpcErrorObject {
  code: number
  message: string
  data?: unknown
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: number | string | null
  result?: unknown
  error?: JsonRpcErrorObject
}

export class McpClientError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'McpClientError'
    this.status = status
  }
}

export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
