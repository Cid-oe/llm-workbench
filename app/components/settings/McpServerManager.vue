<!-- Copyright (c) 2026 llm-workbench contributors. SPDX-License-Identifier: MIT -->

<script setup lang="ts">
import { Plug, Plus, Trash2 } from '@lucide/vue'
import type { McpTransport } from '~/lib/mcp/types'
import { defaultMcpServerDraft, useMcpStore } from '~/stores/useMcpStore'

const { t } = useI18n()
const mcpStore = useMcpStore()

const draft = reactive(defaultMcpServerDraft())
const argsText = ref((draft.args ?? []).join(' '))

onMounted(() => {
  mcpStore.sanitizePersistedServers()
  void mcpStore.refreshCapabilities()
})

const transports: { id: McpTransport, label: string }[] = [
  { id: 'http', label: 'HTTP' },
  { id: 'sse', label: 'SSE' },
  { id: 'stdio', label: 'stdio' },
]

function addServer() {
  const args = argsText.value.split(/\s+/).filter(Boolean)
  const saved = mcpStore.upsertServer({
    name: draft.name,
    transport: draft.transport,
    url: draft.url,
    command: draft.command,
    args,
    authHeader: draft.authHeader,
    enabled: true,
  })
  if (!saved) return
  draft.name = ''
  draft.authHeader = ''
  if (saved.id) void mcpStore.connectServer(saved.id)
}

function argsFor(serverId: string): string {
  return mcpStore.servers.find(s => s.id === serverId)?.args?.join(' ') ?? ''
}
</script>

<template>
  <UiCard class="p-4 space-y-4">
    <div>
      <h2 class="text-sm font-medium flex items-center gap-2">
        <Plug class="h-4 w-4" />
        {{ t('mcp.title') }}
      </h2>
      <p class="text-xs text-muted-foreground mt-1">
        {{ t('mcp.subtitle') }}
      </p>
    </div>

    <p
      v-if="mcpStore.statusChecked && !mcpStore.stdioAvailable"
      class="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
    >
      {{ t('mcp.stdioUnavailable') }}
    </p>

    <p v-if="mcpStore.error" class="text-xs text-red-400">{{ mcpStore.error }}</p>

    <div class="grid gap-3 md:grid-cols-2">
      <div>
        <UiLabel class="mb-1.5 block">{{ t('mcp.name') }}</UiLabel>
        <UiInput v-model="draft.name" :placeholder="t('mcp.namePlaceholder')" />
      </div>
      <div>
        <UiLabel class="mb-1.5 block">{{ t('mcp.transport') }}</UiLabel>
        <select
          v-model="draft.transport"
          class="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option v-for="item in transports" :key="item.id" :value="item.id">
            {{ item.label }}
          </option>
        </select>
      </div>
      <div v-if="draft.transport !== 'stdio'">
        <UiLabel class="mb-1.5 block">{{ t('mcp.url') }}</UiLabel>
        <UiInput v-model="draft.url" placeholder="http://127.0.0.1:3001/mcp" />
      </div>
      <template v-else>
        <div>
          <UiLabel class="mb-1.5 block">{{ t('mcp.command') }}</UiLabel>
          <UiInput v-model="draft.command" placeholder="npx" :disabled="!mcpStore.stdioAvailable" />
        </div>
        <div>
          <UiLabel class="mb-1.5 block">{{ t('mcp.args') }}</UiLabel>
          <UiInput v-model="argsText" placeholder="-y @modelcontextprotocol/server-filesystem" />
        </div>
      </template>
      <div class="md:col-span-2">
        <UiLabel class="mb-1.5 block">{{ t('mcp.authHeader') }}</UiLabel>
        <UiInput
          v-model="draft.authHeader"
          type="password"
          :placeholder="t('mcp.authPlaceholder')"
        />
        <p class="text-[11px] text-muted-foreground mt-1">{{ t('mcp.authHint') }}</p>
      </div>
    </div>

    <UiButton size="sm" :disabled="!draft.name.trim()" @click="addServer">
      <Plus class="h-3.5 w-3.5" />
      {{ t('mcp.add') }}
    </UiButton>

    <div
      v-for="server in mcpStore.servers"
      :key="server.id"
      class="rounded-md border border-border p-3 space-y-2"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-sm font-medium">{{ server.name }}</p>
          <p class="text-xs text-muted-foreground">
            {{ server.transport }}
            ·
            {{ server.transport === 'stdio' ? `${server.command} ${argsFor(server.id)}` : server.url }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs flex items-center gap-1">
            <input
              type="checkbox"
              :checked="server.enabled"
              @change="mcpStore.setEnabled(server.id, ($event.target as HTMLInputElement).checked)"
            >
            {{ t('mcp.enabled') }}
          </label>
          <UiButton size="sm" variant="outline" :disabled="mcpStore.connectingId === server.id" @click="mcpStore.connectServer(server.id)">
            {{ t('mcp.refresh') }}
          </UiButton>
          <UiButton size="sm" variant="ghost" @click="mcpStore.removeServer(server.id)">
            <Trash2 class="h-4 w-4" />
          </UiButton>
        </div>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ t('mcp.tools') }}:
        {{ mcpStore.tools.filter(tool => tool.serverId === server.id).map(tool => tool.name).join(', ') || t('mcp.noTools') }}
      </p>
    </div>
  </UiCard>
</template>
