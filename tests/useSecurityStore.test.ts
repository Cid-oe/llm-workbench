import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSecurityStore } from '../app/stores/useSecurityStore'
import { useProviderStore } from '../app/stores/useProviderStore'
import {
  loadPersistedCryptoKey,
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
    expect(await loadPersistedCryptoKey()).not.toBeNull()
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
  })

  it('bootstrapKeys is a no-op without a master password', async () => {
    const security = useSecurityStore()
    await security.bootstrapKeys()
    expect(security.getCryptoKey()).toBeNull()
  })

  it('bootstrapKeys restores the crypto key and decrypts provider payload', async () => {
    const security = useSecurityStore()
    const provider = useProviderStore()
    provider.setApiKey('openai', 'sk-persisted')
    await security.setupMasterPassword('correct-horse')

    expect(provider.encryptedPayload).not.toBeNull()

    // Simulate cold start: memory cleared, vault metadata + encrypted payload remain
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

  it('bootstrapKeys falls back to the persisted vault key when session is empty', async () => {
    const security = useSecurityStore()
    const provider = useProviderStore()
    provider.setApiKey('openai', 'sk-fallback')
    await security.setupMasterPassword('correct-horse')

    sessionStorage.removeItem('llm-playground-session-key')
    security._cryptoKey = null
    provider.clearDecryptedKeys()

    await security.bootstrapKeys()

    expect(security.getCryptoKey()).not.toBeNull()
    expect(provider.openaiKey).toBe('sk-fallback')
  })
})
