// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { ProviderId } from '~/types/llm'
import type { McpToolDefinition } from './types'

function parametersOf(tool: McpToolDefinition): Record<string, unknown> {
  return tool.inputSchema ?? { type: 'object', properties: {} }
}

function openaiStyle(tools: McpToolDefinition[]) {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: parametersOf(tool),
    },
  }))
}

/** Convert MCP tools into the JSON each provider expects on the chat request. */
export function toProviderToolDefinitions(
  tools: McpToolDefinition[],
  provider: ProviderId,
): unknown[] | Record<string, unknown>[] {
  if (tools.length === 0) return []

  switch (provider) {
    case 'anthropic':
      return tools.map(tool => ({
        name: tool.name,
        description: tool.description ?? '',
        input_schema: parametersOf(tool),
      }))
    case 'gemini':
      return [{
        functionDeclarations: tools.map(tool => ({
          name: tool.name,
          description: tool.description ?? '',
          parameters: parametersOf(tool),
        })),
      }]
    default:
      return openaiStyle(tools)
  }
}

export function applyProviderTools(
  body: Record<string, unknown>,
  tools: McpToolDefinition[] | undefined,
  provider: ProviderId,
): Record<string, unknown> {
  if (!tools?.length) return body
  const mapped = toProviderToolDefinitions(tools, provider)
  return { ...body, tools: mapped }
}
