// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { logger } from '~/lib/logger'
import { McpClientError } from '~/lib/mcp/types'
import { validateMcpStdioRequest } from '~/lib/mcp/validate'
import { runStdioSession } from '../../lib/mcpStdio'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = validateMcpStdioRequest(body)
  if (!parsed.ok) {
    logger.warn('mcp_stdio_validation_failed', { error: parsed.error })
    throw createError({ statusCode: 400, message: parsed.error })
  }

  try {
    logger.info('mcp_stdio_start', { action: parsed.value.action, command: parsed.value.command })
    return await runStdioSession(parsed.value)
  }
  catch (error) {
    const message = error instanceof McpClientError || error instanceof Error
      ? error.message
      : 'stdio MCP failed'
    logger.error('mcp_stdio_failed', { error: message })
    throw createError({ statusCode: 502, message })
  }
})
