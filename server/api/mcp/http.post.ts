// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { logger } from '~/lib/logger'
import { callMcpToolHttp, listMcpToolsHttp } from '~/lib/mcp/httpClient'
import { McpClientError } from '~/lib/mcp/types'
import { validateMcpHttpRequest } from '~/lib/mcp/validate'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = validateMcpHttpRequest(body)
  if (!parsed.ok) {
    logger.warn('mcp_http_validation_failed', { error: parsed.error })
    throw createError({ statusCode: 400, message: parsed.error })
  }

  const request = parsed.value
  try {
    logger.info('mcp_http_proxy_start', { action: request.action, transport: request.transport })
    if (request.action === 'list') {
      const tools = await listMcpToolsHttp({
        url: request.url,
        headers: request.headers,
        transport: request.transport,
      }, 'proxy', 'proxy')
      return { tools }
    }
    const result = await callMcpToolHttp({
      url: request.url,
      headers: request.headers,
      transport: request.transport,
    }, request.toolName ?? '', request.arguments ?? {})
    return { result }
  }
  catch (error) {
    const message = error instanceof McpClientError || error instanceof Error
      ? error.message
      : 'HTTP MCP proxy failed'
    logger.error('mcp_http_proxy_failed', { error: message })
    throw createError({ statusCode: 502, message })
  }
})
