// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { logger } from '~/lib/logger'

export interface ClientErrorPayload {
  message: string
  stack?: string
  source: string
  context?: Record<string, unknown>
}

export type ErrorCapture = (payload: ClientErrorPayload) => void

export type SentryLike = {
  init: (options: { dsn: string, tracesSampleRate?: number }) => void
  captureException: (
    error: Error,
    hint?: { tags?: Record<string, string>, extra?: Record<string, unknown> },
  ) => void
}

let capture: ErrorCapture | null = null
let enabled = false

/** Test-only: inject or clear the capture sink without loading Sentry. */
export function setErrorCaptureForTests(fn: ErrorCapture | null): void {
  capture = fn
  enabled = fn !== null
}

export function isErrorTrackingEnabled(): boolean {
  return enabled
}

/**
 * Initialize optional Sentry browser SDK when a public DSN is provided.
 * No-op when DSN is empty — local/dev stays quiet and Sentry is not required at runtime.
 */
export async function initErrorTracking(
  dsn: string | undefined | null,
  loadSentry: () => Promise<SentryLike> = () => import('@sentry/browser'),
): Promise<boolean> {
  const trimmed = typeof dsn === 'string' ? dsn.trim() : ''
  if (!trimmed) {
    capture = null
    enabled = false
    return false
  }

  const Sentry = await loadSentry()
  Sentry.init({
    dsn: trimmed,
    tracesSampleRate: 0,
  })

  capture = (payload) => {
    const error = new Error(payload.message)
    if (payload.stack) error.stack = payload.stack
    Sentry.captureException(error, {
      tags: { source: payload.source },
      extra: {
        stack: payload.stack,
        ...(payload.context ?? {}),
      },
    })
  }
  enabled = true
  logger.info('error_tracking_enabled', { provider: 'sentry' })
  return true
}

/** Forward a structured client error to the configured sink (if any). */
export function reportClientError(payload: ClientErrorPayload): void {
  if (!capture) return
  try {
    capture(payload)
  }
  catch (err) {
    logger.warn('error_tracking_failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
