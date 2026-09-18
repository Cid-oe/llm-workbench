import { beforeEach, describe, expect, it, vi } from 'vitest'
import { localStore, sessionStore } from '../app/lib/browserStorage'

describe('browserStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('localStore round-trips independently of sessionStore', () => {
    localStore.setItem('vault', 'ciphertext')
    sessionStore.setItem('vault', 'session-copy')

    expect(localStore.getItem('vault')).toBe('ciphertext')
    expect(sessionStore.getItem('vault')).toBe('session-copy')
    expect(localStorage.getItem('vault')).toBe('ciphertext')
    expect(sessionStorage.getItem('vault')).toBe('session-copy')
  })

  it('localStore removeItem and clear', () => {
    localStore.setItem('keep', 'yes')
    localStore.setItem('drop', 'no')
    localStore.removeItem('drop')
    expect(localStore.getItem('drop')).toBeNull()
    expect(localStore.getItem('keep')).toBe('yes')

    localStore.clear()
    expect(localStore.length).toBe(0)
    expect(localStore.key(0)).toBeNull()
  })

  it('returns empty values when native storage is missing', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(localStore.getItem('x')).toBeNull()
    expect(localStore.length).toBe(0)
    localStore.setItem('x', '1')
    localStore.removeItem('x')
    localStore.clear()
    expect(localStore.key(0)).toBeNull()
  })
})
