// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

export function createMcpServerId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
