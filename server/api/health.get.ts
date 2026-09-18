// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { getRuntimeMetrics } from '~/lib/runtimeMetrics'

export default defineEventHandler(() => {
  const metrics = getRuntimeMetrics()
  return {
    status: metrics.status,
    uptimeMs: metrics.uptimeMs,
    timestamp: metrics.timestamp,
  }
})
