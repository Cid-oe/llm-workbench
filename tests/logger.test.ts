// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import { addLogSink, logger } from '../app/lib/logger'

describe('logger', () => {
  it('emits structured events with a timestamp', () => {
    const events: unknown[] = []
    const stop = addLogSink(event => events.push(event))

    const logged = logger.info('stream_start', { provider: 'openai', model: 'gpt-4o-mini' })
    stop()

    expect(logged.level).toBe('info')
    expect(logged.message).toBe('stream_start')
    expect(logged.provider).toBe('openai')
    expect(logged.timestamp).toEqual(expect.any(String))
    expect(events).toHaveLength(1)
  })

  it('redacts sensitive fields before emitting', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const events: Array<Record<string, unknown>> = []
    const stop = addLogSink(event => events.push(event))

    logger.error('upstream_failed', {
      apiKey: 'sk-live-secret',
      authorization: 'Bearer sk-live-secret',
      nested: { password: 'hunter2', model: 'gpt-4o-mini' },
    })
    stop()
    spy.mockRestore()

    expect(events[0].apiKey).toBe('[redacted]')
    expect(events[0].authorization).toBe('[redacted]')
    expect((events[0].nested as { password: string, model: string }).password).toBe('[redacted]')
    expect((events[0].nested as { password: string, model: string }).model).toBe('gpt-4o-mini')
  })
})
