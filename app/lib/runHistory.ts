// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { ModelResponse } from '~/types/llm'

/** Persist history only when at least one slot finished usefully (done/error). */
export function shouldPersistRunHistory(responses: ModelResponse[]): boolean {
  return responses.some(r => r.status === 'done' || r.status === 'error')
}

/** Mark in-flight slots as cancelled after Stop / abort. */
export function markInFlightAsCancelled(responses: ModelResponse[]): ModelResponse[] {
  return responses.map((response) => {
    if (response.status === 'streaming' || response.status === 'idle') {
      return { ...response, status: 'cancelled' as const }
    }
    return response
  })
}
