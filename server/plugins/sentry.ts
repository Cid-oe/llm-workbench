// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import * as Sentry from '@sentry/node'
import { createServerErrorTracker } from '../lib/sentry'

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()
  const tracker = createServerErrorTracker(Sentry, config.public.sentryDsn)

  if (!tracker.enabled) return

  nitroApp.hooks.hook('error', (error, { event }) => {
    tracker.capture(error, {
      method: event?.method,
      path: event?.path,
    })
  })
})
