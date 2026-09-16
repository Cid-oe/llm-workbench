import { describe, expect, it } from 'vitest'
import { markInFlightAsCancelled, shouldPersistRunHistory } from '../app/lib/runHistory'
import type { ModelResponse } from '../app/types/llm'

function response(status: ModelResponse['status']): ModelResponse {
  return {
    slotId: 'slot-1',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    content: 'partial',
    status,
    metrics: { latencyMs: 1, ttftMs: null, inputTokens: 1, outputTokens: 0, costUsd: 0 },
  }
}

describe('runHistory', () => {
  it('persists only when a slot finished as done or error', () => {
    expect(shouldPersistRunHistory([response('cancelled')])).toBe(false)
    expect(shouldPersistRunHistory([response('streaming')])).toBe(false)
    expect(shouldPersistRunHistory([response('done')])).toBe(true)
    expect(shouldPersistRunHistory([response('error')])).toBe(true)
    expect(shouldPersistRunHistory([response('cancelled'), response('done')])).toBe(true)
  })

  it('marks streaming and idle slots as cancelled', () => {
    const next = markInFlightAsCancelled([
      response('streaming'),
      { ...response('done'), slotId: 'slot-2' },
      { ...response('idle'), slotId: 'slot-3' },
    ])
    expect(next.map(r => r.status)).toEqual(['cancelled', 'done', 'cancelled'])
  })
})
