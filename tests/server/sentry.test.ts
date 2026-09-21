// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import { createServerErrorTracker } from '../../server/lib/sentry'

describe('server error tracking', () => {
  it('does not initialise or capture when the DSN is empty', () => {
    const client = {
      init: vi.fn(),
      captureException: vi.fn(),
    }

    const tracker = createServerErrorTracker(client, '')
    tracker.capture(new Error('ignored'), { path: '/api/health' })

    expect(tracker.enabled).toBe(false)
    expect(client.init).not.toHaveBeenCalled()
    expect(client.captureException).not.toHaveBeenCalled()
  })

  it('initialises Sentry and captures server errors with request context', () => {
    const client = {
      init: vi.fn(),
      captureException: vi.fn(),
    }
    const error = new Error('upstream failed')

    const tracker = createServerErrorTracker(client, 'https://public@example.ingest.sentry.io/1', 'test')
    tracker.capture(error, { method: 'POST', path: '/api/stream' })

    expect(tracker.enabled).toBe(true)
    expect(client.init).toHaveBeenCalledWith({
      dsn: 'https://public@example.ingest.sentry.io/1',
      environment: 'test',
    })
    expect(client.captureException).toHaveBeenCalledWith(error, {
      extra: { method: 'POST', path: '/api/stream' },
    })
  })
})
