// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { useMcpStore } from '../../app/stores/useMcpStore'
import { useLocalDiscoveryStore } from '../../app/stores/useLocalDiscoveryStore'
import * as runtime from '~/lib/mcp/runtime'
import * as status from '~/lib/mcp/status'

describe('useMcpStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('upserts sanitized servers and keeps auth headers out of persist pick', () => {
    const store = useMcpStore()
    const saved = store.upsertServer({
      name: 'Files',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'pkg'],
      authHeader: 'Bearer secret',
    })
    expect(saved?.command).toBe('npx')
    expect(store.authHeaders[saved!.id]).toBe('Bearer secret')
    expect(store.upsertServer({ name: 'bad', transport: 'stdio', command: 'rm' })).toBeNull()
    store.removeServer(saved!.id)
    expect(store.servers).toHaveLength(0)
    expect(store.authHeaders[saved!.id]).toBeUndefined()
  })

  it('connects and calls enabled tools', async () => {
    vi.spyOn(status, 'probeMcpCapabilities').mockResolvedValue({ stdio: true, httpProxy: true })
    vi.spyOn(runtime, 'listMcpTools').mockResolvedValue([{
      name: 'lookup',
      serverId: 'ignored',
      serverName: 'ignored',
    }])
    vi.spyOn(runtime, 'callMcpTool').mockResolvedValue('{"ok":true}')

    const store = useMcpStore()
    const saved = store.upsertServer({
      name: 'Search',
      transport: 'http',
      url: 'http://127.0.0.1:9/mcp',
    })
    await store.connectServer(saved!.id)
    expect(store.enabledTools[0]?.name).toBe('lookup')
    expect(store.enabledTools[0]?.serverId).toBe(saved!.id)

    const inspection = await store.callEnabledTool('lookup', '{"q":"a"}')
    expect(inspection.resultJson).toContain('ok')
    expect(inspection.error).toBeUndefined()
  })

  it('blocks non-localhost MCP URLs in air-gapped mode', async () => {
    const local = useLocalDiscoveryStore()
    local.setAirGapped(true)
    const store = useMcpStore()
    const saved = store.upsertServer({
      name: 'Remote',
      transport: 'http',
      url: 'https://mcp.example.com',
    })
    await store.connectServer(saved!.id)
    expect(store.error).toMatch(/Air-gapped/)
  })
})
