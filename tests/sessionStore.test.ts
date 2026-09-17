import { beforeEach, describe, expect, it } from 'vitest'
import { sessionStore } from '~/lib/sessionStore'

describe('sessionStore', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('starts empty', () => {
    expect(sessionStore.length).toBe(0)
    expect(sessionStore.getItem('missing')).toBeNull()
    expect(sessionStore.key(0)).toBeNull()
  })

  it('setItem / getItem / key / length round-trip via sessionStorage', () => {
    sessionStore.setItem('a', '1')
    sessionStore.setItem('b', '2')

    expect(sessionStore.getItem('a')).toBe('1')
    expect(sessionStore.getItem('b')).toBe('2')
    expect(sessionStore.length).toBe(2)
    expect(sessionStore.key(0)).toBe('a')
    expect(sessionStore.key(1)).toBe('b')
    expect(sessionStorage.getItem('a')).toBe('1')
  })

  it('removeItem deletes a key', () => {
    sessionStore.setItem('keep', 'yes')
    sessionStore.setItem('drop', 'no')
    sessionStore.removeItem('drop')

    expect(sessionStore.getItem('drop')).toBeNull()
    expect(sessionStore.getItem('keep')).toBe('yes')
    expect(sessionStore.length).toBe(1)
  })

  it('clear removes all keys', () => {
    sessionStore.setItem('x', '1')
    sessionStore.setItem('y', '2')
    sessionStore.clear()

    expect(sessionStore.length).toBe(0)
    expect(sessionStore.getItem('x')).toBeNull()
    expect(sessionStore.key(0)).toBeNull()
  })
})
