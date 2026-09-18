import { describe, expect, it, vi } from 'vitest'
import {
  COMBINED_PROVIDER_PERSIST_KEY,
  hasSplitProviderPersist,
  isEncryptedPayload,
  markProviderPersistSplit,
  PROVIDER_PERSIST_SPLIT_FLAG,
  readCombinedProviderPersist,
} from '../app/lib/providerPersist'

describe('providerPersist', () => {
  it('reads nested pinia state or a flat persist blob', () => {
    localStorage.setItem(COMBINED_PROVIDER_PERSIST_KEY, JSON.stringify({
      state: { ollamaUrl: 'http://nested:11434' },
    }))
    expect(readCombinedProviderPersist()).toEqual({ ollamaUrl: 'http://nested:11434' })

    localStorage.setItem(COMBINED_PROVIDER_PERSIST_KEY, JSON.stringify({
      ollamaUrl: 'http://flat:11434',
    }))
    expect(readCombinedProviderPersist()).toEqual({ ollamaUrl: 'http://flat:11434' })
  })

  it('returns null for missing, invalid, or non-object persist payloads', () => {
    localStorage.removeItem(COMBINED_PROVIDER_PERSIST_KEY)
    expect(readCombinedProviderPersist()).toBeNull()

    localStorage.setItem(COMBINED_PROVIDER_PERSIST_KEY, '{not-json')
    expect(readCombinedProviderPersist()).toBeNull()

    localStorage.setItem(COMBINED_PROVIDER_PERSIST_KEY, JSON.stringify(['nope']))
    expect(readCombinedProviderPersist()).toBeNull()
  })

  it('tracks the one-time split flag', () => {
    expect(hasSplitProviderPersist()).toBe(false)
    markProviderPersistSplit()
    expect(hasSplitProviderPersist()).toBe(true)
    expect(localStorage.getItem(PROVIDER_PERSIST_SPLIT_FLAG)).toBe('1')
  })

  it('accepts only version-1 encrypted payloads', () => {
    expect(isEncryptedPayload({ v: 1, iv: 'a', data: 'b' })).toBe(true)
    expect(isEncryptedPayload({ v: 2, iv: 'a', data: 'b' })).toBe(false)
    expect(isEncryptedPayload(null)).toBe(false)
    expect(isEncryptedPayload('cipher')).toBe(false)
  })

  it('treats missing localStorage as empty persist', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readCombinedProviderPersist()).toBeNull()
    expect(hasSplitProviderPersist()).toBe(false)
    markProviderPersistSplit()
    expect(hasSplitProviderPersist()).toBe(false)
  })
})
