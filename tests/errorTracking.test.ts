// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  initErrorTracking,
  isErrorTrackingEnabled,
  reportClientError,
  setErrorCaptureForTests,
  type SentryLike,
} from '../app/lib/errorTracking'

describe('errorTracking', () => {
  afterEach(() => {
    setErrorCaptureForTests(null)
    vi.restoreAllMocks()
  })

  it('does not enable tracking when DSN is unset', async () => {
    const loadSentry = vi.fn()
    expect(await initErrorTracking('', loadSentry)).toBe(false)
    expect(await initErrorTracking(undefined, loadSentry)).toBe(false)
    expect(await initErrorTracking('   ', loadSentry)).toBe(false)
    expect(isErrorTrackingEnabled()).toBe(false)
    expect(loadSentry).not.toHaveBeenCalled()

    reportClientError({ message: 'x', source: 'test' })
  })

  it('forwards a structured payload to the capture sink', () => {
    const capture = vi.fn()
    setErrorCaptureForTests(capture)

    reportClientError({
      message: 'boom',
      stack: 'Error: boom\n    at foo',
      source: 'window.error',
      context: { filename: 'app.js', lineno: 12 },
    })

    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith({
      message: 'boom',
      stack: 'Error: boom\n    at foo',
      source: 'window.error',
      context: { filename: 'app.js', lineno: 12 },
    })
  })

  it('swallows capture failures without throwing', () => {
    setErrorCaptureForTests(() => {
      throw new Error('sink down')
    })
    expect(() => {
      reportClientError({ message: 'still ok', source: 'test' })
    }).not.toThrow()
  })

  it('initializes Sentry and reports structured exceptions when DSN is set', async () => {
    const init = vi.fn()
    const captureException = vi.fn()
    const sentry: SentryLike = { init, captureException }
    const loadSentry = vi.fn(async () => sentry)

    const ok = await initErrorTracking('https://key@o0.ingest.sentry.io/1', loadSentry)
    expect(ok).toBe(true)
    expect(isErrorTrackingEnabled()).toBe(true)
    expect(loadSentry).toHaveBeenCalledTimes(1)
    expect(init).toHaveBeenCalledWith({
      dsn: 'https://key@o0.ingest.sentry.io/1',
      tracesSampleRate: 0,
    })

    reportClientError({
      message: 'tracked',
      stack: 'Error: tracked',
      source: 'unhandledrejection',
      context: { foo: 'bar' },
    })

    expect(captureException).toHaveBeenCalledTimes(1)
    const [err, opts] = captureException.mock.calls[0]
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('tracked')
    expect((err as Error).stack).toBe('Error: tracked')
    expect(opts).toEqual({
      tags: { source: 'unhandledrejection' },
      extra: { stack: 'Error: tracked', foo: 'bar' },
    })
  })
})
