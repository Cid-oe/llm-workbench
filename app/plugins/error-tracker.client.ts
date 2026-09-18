// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { initErrorTracking, reportClientError } from '~/lib/errorTracking'
import { logger } from '~/lib/logger'

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  const dsn = typeof config.public.sentryDsn === 'string' ? config.public.sentryDsn : ''
  await initErrorTracking(dsn)

  window.addEventListener('error', (event) => {
    const message = event.error instanceof Error ? event.error.message : String(event.message)
    const stack = event.error instanceof Error ? event.error.stack : undefined
    logger.error('client_error', {
      source: 'window.error',
      message,
    })
    reportClientError({
      message,
      stack,
      source: 'window.error',
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    logger.error('client_unhandled_rejection', {
      source: 'unhandledrejection',
      message,
    })
    reportClientError({
      message,
      stack,
      source: 'unhandledrejection',
    })
  })
})
