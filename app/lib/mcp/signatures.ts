// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { DetectedToolCall, ToolSignature } from '~/lib/toolCall'
import type { McpToolDefinition } from './types'

export function mcpToolsToSignatures(tools: McpToolDefinition[]): ToolSignature[] {
  return tools.map(tool => ({
    id: `mcp:${tool.serverId}:${tool.name}`,
    name: tool.name,
    description: tool.description,
    parametersJson: tool.inputSchema ? JSON.stringify(tool.inputSchema, null, 2) : undefined,
    source: 'mcp',
    serverId: tool.serverId,
  }))
}

export function mergeToolSignatures(
  local: ToolSignature[],
  mcpTools: McpToolDefinition[],
): ToolSignature[] {
  const mapped = mcpToolsToSignatures(mcpTools)
  const mcpNames = new Set(mapped.map(tool => tool.name))
  return [...local.filter(tool => !mcpNames.has(tool.name) || tool.source === 'mcp'), ...mapped]
}

export function matchMcpTool(
  call: DetectedToolCall,
  tools: McpToolDefinition[],
): McpToolDefinition | undefined {
  return tools.find(tool => tool.name.trim() === call.name.trim())
}

export function formatToolCatalog(tools: McpToolDefinition[]): string {
  if (!tools.length) return ''
  const lines = tools.map((tool) => {
    const schema = tool.inputSchema ? JSON.stringify(tool.inputSchema) : '{"type":"object"}'
    return `- ${tool.name}: ${tool.description ?? 'MCP tool'}\n  parameters: ${schema}`
  })
  return [
    'You can call tools by responding with JSON only in this shape:',
    '{"tool_calls":[{"function":{"name":"tool_name","arguments":"{\\"arg\\":\\"value\\"}"}}]}',
    'Available tools:',
    ...lines,
  ].join('\n')
}

export function injectToolsIntoSystemPrompt(systemPrompt: string, tools: McpToolDefinition[]): string {
  const catalog = formatToolCatalog(tools)
  if (!catalog) return systemPrompt
  if (systemPrompt.includes('Available tools:')) return systemPrompt
  return `${systemPrompt.trim()}\n\n${catalog}`
}
