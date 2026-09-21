// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { MCP_CLIENT_INFO } from '~/lib/mcp/types'
import { stringifyToolResult } from '~/lib/mcp/protocol'
import type { McpStdioProxyRequest } from '~/lib/mcp/validate'

export interface StdioToolInfo {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface StdioMcpBridge {
  listTools: () => Promise<StdioToolInfo[]>
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>
  close: () => Promise<void>
}

export type StdioBridgeFactory = (request: Pick<McpStdioProxyRequest, 'command' | 'args' | 'env'>) => Promise<StdioMcpBridge>

function schemaObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export async function createSdkStdioBridge(
  request: Pick<McpStdioProxyRequest, 'command' | 'args' | 'env'>,
): Promise<StdioMcpBridge> {
  const transport = new StdioClientTransport({
    command: request.command,
    args: request.args,
    env: Object.keys(request.env).length ? request.env : undefined,
    stderr: 'pipe',
  })
  const client = new Client(MCP_CLIENT_INFO)
  await client.connect(transport)

  return {
    async listTools() {
      const listed = await client.listTools()
      return (listed.tools ?? []).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: schemaObject(tool.inputSchema),
      }))
    },
    async callTool(name, args) {
      return client.callTool({ name, arguments: args })
    },
    async close() {
      await client.close()
    },
  }
}

export async function runStdioSession(
  request: McpStdioProxyRequest,
  factory: StdioBridgeFactory = createSdkStdioBridge,
): Promise<{ tools?: StdioToolInfo[], result?: string }> {
  const bridge = await factory(request)
  try {
    if (request.action === 'list') {
      return { tools: await bridge.listTools() }
    }
    const raw = await bridge.callTool(request.toolName ?? '', request.arguments ?? {})
    return { result: stringifyToolResult(raw) }
  }
  finally {
    await bridge.close()
  }
}
