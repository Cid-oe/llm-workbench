// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import {
  getRuntimeMetrics,
  recordStreamError,
  recordStreamRequest,
  resetRuntimeMetrics,
} from '../app/lib/runtimeMetrics'

describe('runtimeMetrics', () => {
  it('records stream request and error counters', () => {
    resetRuntimeMetrics()

    recordStreamRequest()
    recordStreamRequest()
    recordStreamError()

    const snapshot = getRuntimeMetrics()
    expect(snapshot.status).toBe('ok')
    expect(snapshot.streamRequests).toBe(2)
    expect(snapshot.streamErrors).toBe(1)
    expect(snapshot.uptimeMs).toBeGreaterThanOrEqual(0)
    expect(snapshot.timestamp).toEqual(expect.any(String))
  })
})
