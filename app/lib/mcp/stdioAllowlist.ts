// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

/** Basenames allowed for stdio MCP servers (spawn argv, never a shell). */
export const STDIO_COMMAND_ALLOWLIST = [
  'npx',
  'node',
  'npm',
  'pnpm',
  'yarn',
  'python',
  'python3',
  'uv',
  'uvx',
  'docker',
] as const

export const MAX_STDIO_ARGS = 32

export function stdioCommandBasename(command: string): string {
  const normalized = command.replace(/\\/g, '/').trim()
  const base = normalized.split('/').pop() ?? ''
  return base.replace(/\.exe$/i, '').toLowerCase()
}

export function isAllowedStdioCommand(command: string): boolean {
  const name = stdioCommandBasename(command)
  return (STDIO_COMMAND_ALLOWLIST as readonly string[]).includes(name)
}
