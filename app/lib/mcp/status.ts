// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { FetchImpl, McpCapabilities } from './types'

export function resolveMcpApiUrl(path: string, baseURL = '/'): string {
  const base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

const UNAVAILABLE: McpCapabilities = { stdio: false, httpProxy: false }

export async function probeMcpCapabilities(
  fetchImpl: FetchImpl = fetch,
  baseURL = '/',
): Promise<McpCapabilities> {
  const url = resolveMcpApiUrl('/api/mcp/status', baseURL)
  try {
    const response = await fetchImpl(url, { method: 'GET' })
    if (!response.ok) return UNAVAILABLE
    const body = await response.json() as Partial<McpCapabilities>
    return {
      stdio: body.stdio === true,
      httpProxy: body.httpProxy === true,
    }
  }
  catch {
    return UNAVAILABLE
  }
}
