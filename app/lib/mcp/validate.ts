// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import * as v from 'valibot'
import { firstSchemaIssue, isAllowedUrl } from '~/lib/validateStreamRequest'
import { isAllowedStdioCommand, MAX_STDIO_ARGS } from './stdioAllowlist'
import { MCP_TRANSPORTS, type McpServerConfig, type McpTransport } from './types'

export const ALLOWED_MCP_HEADER_NAMES = ['authorization', 'x-api-key'] as const
export const MAX_MCP_HEADER_VALUE = 4096
export const MAX_MCP_ENV_ENTRIES = 16

export type McpProxyAction = 'list' | 'call'

export interface McpStdioProxyRequest {
  action: McpProxyAction
  command: string
  args: string[]
  env: Record<string, string>
  toolName?: string
  arguments?: Record<string, unknown>
}

export interface McpHttpProxyRequest {
  action: McpProxyAction
  transport: 'http' | 'sse'
  url: string
  headers: Record<string, string>
  toolName?: string
  arguments?: Record<string, unknown>
}

export type ValidationResult<T> =
  | { ok: true, value: T }
  | { ok: false, error: string }

const actionSchema = v.picklist(['list', 'call'] as const, 'Invalid MCP action')

const commandSchema = v.pipe(
  v.string('command must be a string'),
  v.transform(value => value.trim()),
  v.minLength(1, 'Missing stdio command'),
  v.check(isAllowedStdioCommand, 'stdio command is not on the allowlist'),
)

const argsSchema = v.pipe(
  v.optional(v.array(v.string('Each stdio arg must be a string'), 'args must be an array'), []),
  v.maxLength(MAX_STDIO_ARGS, `stdio args exceed ${MAX_STDIO_ARGS}`),
)

function parseEnv(value: unknown): Record<string, string> {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('env must be an object')
  }
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > MAX_MCP_ENV_ENTRIES) {
    throw new Error(`env exceeds ${MAX_MCP_ENV_ENTRIES} entries`)
  }
  const env: Record<string, string> = {}
  for (const [key, nested] of entries) {
    if (!key.trim() || typeof nested !== 'string') {
      throw new Error('env values must be strings')
    }
    env[key] = nested
  }
  return env
}

export function sanitizeMcpHeaders(value: unknown): Record<string, string> {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('headers must be an object')
  }
  const headers: Record<string, string> = {}
  for (const [rawKey, nested] of Object.entries(value as Record<string, unknown>)) {
    const key = rawKey.trim()
    if (!(ALLOWED_MCP_HEADER_NAMES as readonly string[]).includes(key.toLowerCase())) {
      throw new Error(`Header "${rawKey}" is not allowlisted`)
    }
    if (typeof nested !== 'string' || nested.length > MAX_MCP_HEADER_VALUE) {
      throw new Error('MCP header values must be strings ≤ 4096 characters')
    }
    headers[key] = nested
  }
  return headers
}

const stdioObject = v.pipe(
  v.object({
    action: actionSchema,
    command: commandSchema,
    args: argsSchema,
    env: v.optional(v.unknown()),
    toolName: v.optional(v.string('toolName must be a string')),
    arguments: v.optional(v.record(v.string(), v.unknown())),
  }, 'Request body must be an object'),
  v.check((input) => {
    if (input.action !== 'call') return true
    return typeof input.toolName === 'string' && input.toolName.trim().length > 0
  }, 'call action requires toolName'),
)

export function validateMcpStdioRequest(body: unknown): ValidationResult<McpStdioProxyRequest> {
  const parsed = v.safeParse(stdioObject, body)
  if (!parsed.success) return { ok: false, error: firstSchemaIssue(parsed.issues) }
  try {
    const env = parseEnv(parsed.output.env)
    return {
      ok: true,
      value: {
        action: parsed.output.action,
        command: parsed.output.command,
        args: parsed.output.args ?? [],
        env,
        toolName: parsed.output.toolName?.trim(),
        arguments: parsed.output.arguments,
      },
    }
  }
  catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid env' }
  }
}

const httpObject = v.pipe(
  v.object({
    action: actionSchema,
    transport: v.picklist(['http', 'sse'] as const, 'Invalid MCP HTTP transport'),
    url: v.pipe(
      v.string('Invalid url'),
      v.check(isAllowedUrl, 'Invalid url'),
    ),
    headers: v.optional(v.unknown()),
    toolName: v.optional(v.string('toolName must be a string')),
    arguments: v.optional(v.record(v.string(), v.unknown())),
  }, 'Request body must be an object'),
  v.check((input) => {
    if (input.action !== 'call') return true
    return typeof input.toolName === 'string' && input.toolName.trim().length > 0
  }, 'call action requires toolName'),
)

export function validateMcpHttpRequest(body: unknown): ValidationResult<McpHttpProxyRequest> {
  const parsed = v.safeParse(httpObject, body)
  if (!parsed.success) return { ok: false, error: firstSchemaIssue(parsed.issues) }
  try {
    return {
      ok: true,
      value: {
        action: parsed.output.action,
        transport: parsed.output.transport,
        url: parsed.output.url,
        headers: sanitizeMcpHeaders(parsed.output.headers),
        toolName: parsed.output.toolName?.trim(),
        arguments: parsed.output.arguments,
      },
    }
  }
  catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid headers' }
  }
}

export function sanitizeMcpServerConfig(value: unknown): McpServerConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  const transport = MCP_TRANSPORTS.includes(record.transport as McpTransport)
    ? record.transport as McpTransport
    : null
  if (!id || !name || !transport) return null

  const args = Array.isArray(record.args)
    ? record.args.filter((item): item is string => typeof item === 'string').slice(0, MAX_STDIO_ARGS)
    : []

  const url = typeof record.url === 'string' ? record.url.trim() : ''
  const command = typeof record.command === 'string' ? record.command.trim() : ''

  if (transport === 'stdio') {
    if (!isAllowedStdioCommand(command)) return null
  }
  else if (!isAllowedUrl(url)) {
    return null
  }

  return {
    id,
    name,
    enabled: record.enabled !== false,
    transport,
    url: transport === 'stdio' ? undefined : url,
    command: transport === 'stdio' ? command : undefined,
    args: transport === 'stdio' ? args : undefined,
  }
}
