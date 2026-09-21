// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

export interface ServerSentryClient {
  init(options: { dsn: string; environment?: string }): void
  captureException(error: unknown, context?: { extra?: Record<string, unknown> }): string
}

export interface ServerErrorTracker {
  enabled: boolean
  capture(error: unknown, context: Record<string, unknown>): void
}

/** Create a server error tracker without contacting Sentry when no DSN is configured. */
export function createServerErrorTracker(
  client: ServerSentryClient,
  dsn: string | undefined,
  environment = process.env.NODE_ENV,
): ServerErrorTracker {
  if (!dsn) {
    return { enabled: false, capture: () => {} }
  }

  client.init({ dsn, environment })

  return {
    enabled: true,
    capture: (error, context) => {
      client.captureException(error, { extra: context })
    },
  }
}
