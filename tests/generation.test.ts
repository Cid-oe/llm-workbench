import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  resolveGenerationParams,
} from '../app/lib/generation'

describe('generation', () => {
  it('applies defaults when values are missing', () => {
    expect(resolveGenerationParams()).toEqual({
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS,
    })
  })

  it('clamps out-of-range values', () => {
    expect(resolveGenerationParams({ temperature: -1, maxTokens: 999999 })).toEqual({
      temperature: 0,
      maxTokens: 128_000,
    })
  })
})
