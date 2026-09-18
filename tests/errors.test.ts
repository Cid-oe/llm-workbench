// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import { StreamError, isStreamError } from '../app/lib/errors'
import { addLogSink, logger } from '../app/lib/logger'

describe('StreamError', () => {
  it('serializes to a stable log-safe payload', () => {
    const error = new StreamError({
      message: 'quota exceeded',
      code: 'http',
      provider: 'openai',
      status: 429,
      cause: new Error('upstream refused'),
    })

    expect(isStreamError(error)).toBe(true)
    expect(error.toLogFields()).toEqual({
      code: 'http',
      message: 'quota exceeded',
      provider: 'openai',
      status: 429,
      cause: 'upstream refused',
    })
    expect(JSON.parse(JSON.stringify(error))).toMatchObject({
      code: 'http',
      message: 'quota exceeded',
      provider: 'openai',
      status: 429,
    })
  })

  it('summarizes non-Error causes without embedding raw objects', () => {
    const error = new StreamError({
      message: 'Stream failed',
      code: 'unknown',
      provider: 'anthropic',
      cause: { apiKey: 'sk-live-secret', detail: 'boom' },
    })

    expect(error.toLogFields().cause).toBe('unknown')
    expect(JSON.stringify(error.toLogFields())).not.toContain('sk-live-secret')
  })

  it('logger redacts secrets when StreamError fields nest sensitive keys', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const events: Array<Record<string, unknown>> = []
    const stop = addLogSink(event => events.push(event))

    const error = new StreamError({
      message: 'Network error',
      code: 'network',
      provider: 'openai',
      cause: new Error('fetch failed'),
    })

    logger.error('stream_direct_network_error', {
      apiKey: 'sk-should-not-appear',
      error: error.toLogFields(),
    })
    stop()
    spy.mockRestore()

    const payload = JSON.stringify(events[0])
    expect(events[0].apiKey).toBe('[redacted]')
    expect(payload).not.toContain('sk-should-not-appear')
    expect((events[0].error as { code: string }).code).toBe('network')
    expect((events[0].error as { cause: string }).cause).toBe('fetch failed')
  })
})
