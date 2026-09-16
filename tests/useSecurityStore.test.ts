import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSecurityStore } from '../app/stores/useSecurityStore'
import { useProviderStore } from '../app/stores/useProviderStore'
import {
  hasLegacyPersistedCryptoKey,
  loadSessionCryptoKey,
} from '../app/lib/crypto'

describe('useSecurityStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({
      stubActions: false,
      createSpy: vi.fn,
    }))
  })

  it('rejects short master passwords on setup', async () => {
    const security = useSecurityStore()
    await expect(security.setupMasterPassword('short')).rejects.toThrow(/at least 8 characters/i)
    expect(security.hasMasterPassword).toBe(false)
    expect(security.isUnlocked).toBe(false)
  })

  it('sets up a master password and unlocks the vault UI', async () => {
    const security = useSecurityStore()
    const provider = useProviderStore()
    provider.setApiKey('openai', 'sk-live')

    await security.setupMasterPassword('correct-horse')

    expect(security.hasMasterPassword).toBe(true)
    expect(security.isUnlocked).toBe(true)
    expect(security.isLocked).toBe(false)
    expect(security.hideKeyValues).toBe(false)
    expect(security.getCryptoKey()).not.toBeNull()
    expect(provider.encryptedPayload).not.toBeNull()
    expect(await loadSessionCryptoKey()).not.toBeNull()
    expect(localStorage.getItem('llm-playground-vault-key')).toBeNull()
    expect(hasLegacyPersistedCryptoKey()).toBe(false)
  })

  it('unlocks with the correct password and rejects a wrong one', async () => {
    const security = useSecurityStore()
    await security.setupMasterPassword('correct-horse')
    security.lock()
    expect(security.isLocked).toBe(true)
    expect(security.hideKeyValues).toBe(true)
    // Lock only hides UI — crypto key stays in memory
    expect(security.getCryptoKey()).not.toBeNull()

    expect(await security.unlock('wrong-password')).toBe(false)
    expect(security.isUnlocked).toBe(false)

    expect(await security.unlock('correct-horse')).toBe(true)
    expect(security.isUnlocked).toBe(true)
  })

  it('lock only toggles UI visibility flags', async () => {
    const security = useSecurityStore()
    await security.setupMasterPassword('correct-horse')
    const keyBefore = security.getCryptoKey()

    security.lock()

    expect(security.isUnlocked).toBe(false)
    expect(security.isLocked).toBe(true)
    expect(security.getCryptoKey()).toBe(keyBefore)
  })

  it('changeMasterPassword rejects bad current password and short new password', async () => {
    const security = useSecurityStore()
    await security.setupMasterPassword('correct-horse')

    expect(await security.changeMasterPassword('nope', 'new-password')).toBe(false)
    await expect(security.changeMasterPassword('correct-horse', 'short')).rejects.toThrow(/at least 8 characters/i)
  })

  it('changeMasterPassword rotates salt/verifier and keeps encrypting keys', async () => {
    const security = useSecurityStore()
    const provider = useProviderStore()
    provider.setApiKey('openai', 'sk-before')
    await security.setupMasterPassword('correct-horse')
    const oldVerifier = security.passwordVerifier

    expect(await security.changeMasterPassword('correct-horse', 'new-secure-pass')).toBe(true)
    expect(security.passwordVerifier).not.toBe(oldVerifier)
    expect(security.isUnlocked).toBe(true)
    expect(await security.unlock('correct-horse')).toBe(false)
    expect(await security.unlock('new-secure-pass')).toBe(true)
    expect(provider.openaiKey).toBe('sk-before')
    expect(await loadSessionCryptoKey()).not.toBeNull()
  })

  it('bootstrapKeys is a no-op without a master password', async () => {
    const security = useSecurityStore()
    await security.bootstrapKeys()
    expect(security.getCryptoKey()).toBeNull()
  })

  it('bootstrapKeys restores the crypto key from sessionStorage and decrypts provider payload', async () => {
    const security = useSecurityStore()
    const provider = useProviderStore()
    provider.setApiKey('openai', 'sk-persisted')
    await security.setupMasterPassword('correct-horse')

    expect(provider.encryptedPayload).not.toBeNull()

    // Soft reload within the same browser session: memory cleared, sessionStorage kept
    security._cryptoKey = null
    security.isUnlocked = false
    provider.clearDecryptedKeys()
    expect(provider.openaiKey).toBe('')

    await security.bootstrapKeys()

    expect(security.getCryptoKey()).not.toBeNull()
    expect(provider.openaiKey).toBe('sk-persisted')
    // UI stays locked until explicit unlock
    expect(security.isUnlocked).toBe(false)
    expect(security.hideKeyValues).toBe(true)
  })

  it('bootstrapKeys does not auto-unlock from a legacy localStorage key', async () => {
    const security = useSecurityStore()
    const provider = useProviderStore()
    provider.setApiKey('openai', 'sk-fallback')
    await security.setupMasterPassword('correct-horse')

    const raw = sessionStorage.getItem('llm-playground-session-key')
    expect(raw).toBeTruthy()
    // Simulate a pre-#21 install that also wrote the raw key to localStorage
    localStorage.setItem('llm-playground-vault-key', raw!)

    // Cold start: sessionStorage gone, only localStorage legacy key remains
    sessionStorage.removeItem('llm-playground-session-key')
    security._cryptoKey = null
    security.isUnlocked = false
    provider.clearDecryptedKeys()

    await security.bootstrapKeys()

    expect(security.getCryptoKey()).toBeNull()
    expect(provider.openaiKey).toBe('')
    expect(hasLegacyPersistedCryptoKey()).toBe(false)
  })
})
