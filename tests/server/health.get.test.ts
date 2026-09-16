import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadHandler, stubNitroGlobals } from './nitroTestUtils'

describe('server/api/health.get', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('returns status, uptimeMs, and timestamp from runtime metrics', async () => {
    stubNitroGlobals()
    const { recordStreamRequest } = await import('~/lib/runtimeMetrics')
    recordStreamRequest()

    const handler = await loadHandler('../../server/api/health.get')
    const result = await handler({}) as {
      status: string
      uptimeMs: number
      timestamp: string
    }

    expect(result).toEqual({
      status: 'ok',
      uptimeMs: expect.any(Number),
      timestamp: expect.any(String),
    })
    expect(result.uptimeMs).toBeGreaterThanOrEqual(0)
    expect(result).not.toHaveProperty('streamRequests')
  })
})
