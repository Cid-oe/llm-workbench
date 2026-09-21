// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { defineStore } from 'pinia'
import { assertAirGappedUrl } from '~/lib/localDiscovery'
import { createMcpServerId } from '~/lib/mcp/ids'
import * as mcpRuntime from '~/lib/mcp/runtime'
import * as mcpStatus from '~/lib/mcp/status'
import {
  type McpCapabilities,
  type McpServerConfig,
  type McpToolCallInspection,
  type McpToolDefinition,
  type McpTransport,
  McpClientError,
} from '~/lib/mcp/types'
import { sanitizeMcpServerConfig } from '~/lib/mcp/validate'
import { useLocalDiscoveryStore } from './useLocalDiscoveryStore'

export const MCP_PERSIST_KEY = 'llm-workbench-mcp'

function defaultDraft(): Omit<McpServerConfig, 'id'> & { authHeader: string } {
  return {
    name: '',
    enabled: true,
    transport: 'http',
    url: 'http://127.0.0.1:3001/mcp',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    authHeader: '',
  }
}

export const useMcpStore = defineStore('mcp', {
  state: () => ({
    servers: [] as McpServerConfig[],
    tools: [] as McpToolDefinition[],
    authHeaders: {} as Record<string, string>,
    capabilities: { stdio: false, httpProxy: false } as McpCapabilities,
    statusChecked: false,
    connectingId: '',
    error: '',
  }),

  getters: {
    enabledServers(state): McpServerConfig[] {
      return state.servers.filter(server => server.enabled)
    },
    enabledTools(state): McpToolDefinition[] {
      const enabled = new Set(state.servers.filter(s => s.enabled).map(s => s.id))
      return state.tools.filter(tool => enabled.has(tool.serverId))
    },
    stdioAvailable(state): boolean {
      return state.capabilities.stdio
    },
  },

  actions: {
    sanitizePersistedServers() {
      this.servers = this.servers
        .map(server => sanitizeMcpServerConfig(server))
        .filter((server): server is McpServerConfig => !!server)
    },

    setAuthHeader(serverId: string, value: string) {
      const trimmed = value.trim()
      const next: Record<string, string> = {}
      for (const [key, header] of Object.entries(this.authHeaders)) {
        if (key !== serverId) next[key] = header
      }
      if (trimmed) next[serverId] = trimmed
      this.authHeaders = next
    },

    upsertServer(input: {
      id?: string
      name: string
      transport: McpTransport
      url?: string
      command?: string
      args?: string[]
      enabled?: boolean
      authHeader?: string
    }): McpServerConfig | null {
      const id = input.id?.trim() || createMcpServerId()
      const sanitized = sanitizeMcpServerConfig({
        id,
        name: input.name,
        transport: input.transport,
        url: input.url,
        command: input.command,
        args: input.args,
        enabled: input.enabled !== false,
      })
      if (!sanitized) {
        this.error = 'Invalid MCP server configuration'
        return null
      }
      const idx = this.servers.findIndex(server => server.id === id)
      if (idx === -1) this.servers.push(sanitized)
      else this.servers[idx] = sanitized
      if (input.authHeader !== undefined) this.setAuthHeader(id, input.authHeader)
      this.error = ''
      return sanitized
    },

    removeServer(id: string) {
      this.servers = this.servers.filter(server => server.id !== id)
      this.tools = this.tools.filter(tool => tool.serverId !== id)
      this.setAuthHeader(id, '')
    },

    setEnabled(id: string, enabled: boolean) {
      const idx = this.servers.findIndex(server => server.id === id)
      const current = idx === -1 ? undefined : this.servers[idx]
      if (!current) return
      this.servers[idx] = { ...current, enabled }
    },

    async refreshCapabilities() {
      this.capabilities = await mcpStatus.probeMcpCapabilities()
      this.statusChecked = true
    },

    runtimeOptions(server: McpServerConfig) {
      const header = this.authHeaders[server.id]
      return {
        headers: header ? { Authorization: header } : undefined,
        capabilities: this.capabilities,
      }
    },

    async connectServer(id: string) {
      const server = this.servers.find(item => item.id === id)
      if (!server) return
      if (!this.statusChecked) await this.refreshCapabilities()

      const local = useLocalDiscoveryStore()
      if (local.airGapped && server.transport !== 'stdio') {
        try {
          assertAirGappedUrl(server.url ?? '', true)
        }
        catch (error) {
          this.error = error instanceof Error ? error.message : 'Air-gapped MCP URL blocked'
          return
        }
      }

      this.connectingId = id
      this.error = ''
      try {
        const tools = await mcpRuntime.listMcpTools(server, this.runtimeOptions(server))
        this.tools = [
          ...this.tools.filter(tool => tool.serverId !== id),
          ...tools.map(tool => ({ ...tool, serverId: id, serverName: server.name })),
        ]
      }
      catch (error) {
        this.error = error instanceof McpClientError || error instanceof Error
          ? error.message
          : 'Failed to list MCP tools'
        this.tools = this.tools.filter(tool => tool.serverId !== id)
      }
      finally {
        this.connectingId = ''
      }
    },

    async callEnabledTool(toolName: string, argumentsJson: string): Promise<McpToolCallInspection> {
      if (!this.statusChecked) await this.refreshCapabilities()
      const tool = this.enabledTools.find(item => item.name === toolName)
      const server = this.servers.find(item => item.id === tool?.serverId && item.enabled)
      if (!tool || !server) {
        throw new McpClientError(`No enabled MCP server exposes tool "${toolName}"`)
      }

      const started = Date.now()
      try {
        const resultJson = await mcpRuntime.callMcpTool(server, toolName, argumentsJson, this.runtimeOptions(server))
        return {
          serverId: server.id,
          serverName: server.name,
          toolName,
          argumentsJson,
          resultJson,
          durationMs: Date.now() - started,
        }
      }
      catch (error) {
        const message = error instanceof Error ? error.message : 'MCP tool call failed'
        return {
          serverId: server.id,
          serverName: server.name,
          toolName,
          argumentsJson,
          resultJson: '',
          error: message,
          durationMs: Date.now() - started,
        }
      }
    },
  },

  persist: {
    key: MCP_PERSIST_KEY,
    pick: ['servers'],
  },
})

export { defaultDraft as defaultMcpServerDraft }
