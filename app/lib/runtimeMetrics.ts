// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

const startedAt = Date.now()

export interface RuntimeMetricsSnapshot {
  status: 'ok'
  uptimeMs: number
  timestamp: string
  streamRequests: number
  streamErrors: number
}

const counters = {
  streamRequests: 0,
  streamErrors: 0,
}

export function recordStreamRequest(): void {
  counters.streamRequests += 1
}

export function recordStreamError(): void {
  counters.streamErrors += 1
}

export function getRuntimeMetrics(): RuntimeMetricsSnapshot {
  return {
    status: 'ok',
    uptimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
    streamRequests: counters.streamRequests,
    streamErrors: counters.streamErrors,
  }
}

export function resetRuntimeMetrics(): void {
  counters.streamRequests = 0
  counters.streamErrors = 0
}
