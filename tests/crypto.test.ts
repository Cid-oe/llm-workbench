import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSessionCryptoKey,
  decryptJson,
  deriveKey,
  encryptJson,
  generateSalt,
  hashPassword,
  hasLegacyPersistedCryptoKey,
  loadSessionCryptoKey,
  parseSalt,
  purgeLegacyPersistedCryptoKey,
  saveSessionCryptoKey,
  verifyPassword,
  type ApiKeysPayload,
} from '../app/lib/crypto'

describe('crypto', () => {
  const sampleKeys: ApiKeysPayload = {
    openaiKey: 'sk-test-openai',
    anthropicKey: 'sk-ant-test',
    geminiKey: 'AIza-test',
    groqKey: 'gsk_test',
  }

  beforeEach(() => {
    clearSessionCryptoKey()
  })

  it('encrypts and decrypts API keys payload', async () => {
    const salt = parseSalt(generateSalt())
    const key = await deriveKey('my-secure-password', salt)
    const encrypted = await encryptJson(key, sampleKeys)
    const decrypted = await decryptJson<ApiKeysPayload>(key, encrypted)
    expect(decrypted).toEqual(sampleKeys)
  })

  it('verifies master password hash', async () => {
    const salt = generateSalt()
    const verifier = await hashPassword('correct-horse', salt)
    expect(await verifyPassword('correct-horse', salt, verifier)).toBe(true)
    expect(await verifyPassword('wrong-password', salt, verifier)).toBe(false)
  })

  it('produces different ciphertext for same payload', async () => {
    const salt = parseSalt(generateSalt())
    const key = await deriveKey('password123', salt)
    const a = await encryptJson(key, sampleKeys)
    const b = await encryptJson(key, sampleKeys)
    expect(a.data).not.toBe(b.data)
  })

  it('persists the crypto key only in sessionStorage', async () => {
    const key = await deriveKey('session-pass', parseSalt(generateSalt()))
    await saveSessionCryptoKey(key)

    expect(await loadSessionCryptoKey()).not.toBeNull()
    expect(localStorage.getItem('llm-playground-vault-key')).toBeNull()
    expect(hasLegacyPersistedCryptoKey()).toBe(false)

    const fromSession = await loadSessionCryptoKey()
    const roundTrip = await encryptJson(fromSession!, sampleKeys)
    await expect(decryptJson<ApiKeysPayload>(fromSession!, roundTrip)).resolves.toEqual(sampleKeys)
  })

  it('saveSessionCryptoKey purges a legacy localStorage vault key', async () => {
    localStorage.setItem('llm-playground-vault-key', 'legacy-raw-key')
    expect(hasLegacyPersistedCryptoKey()).toBe(true)

    const key = await deriveKey('session-pass', parseSalt(generateSalt()))
    await saveSessionCryptoKey(key)

    expect(hasLegacyPersistedCryptoKey()).toBe(false)
    expect(localStorage.getItem('llm-playground-vault-key')).toBeNull()
  })

  it('clearSessionCryptoKey removes session and legacy storage', async () => {
    const key = await deriveKey('session-pass', parseSalt(generateSalt()))
    await saveSessionCryptoKey(key)
    localStorage.setItem('llm-playground-vault-key', 'stale')
    clearSessionCryptoKey()

    expect(await loadSessionCryptoKey()).toBeNull()
    expect(hasLegacyPersistedCryptoKey()).toBe(false)
  })

  it('purgeLegacyPersistedCryptoKey leaves sessionStorage intact', async () => {
    const key = await deriveKey('session-pass', parseSalt(generateSalt()))
    await saveSessionCryptoKey(key)
    localStorage.setItem('llm-playground-vault-key', 'stale')

    purgeLegacyPersistedCryptoKey()

    expect(hasLegacyPersistedCryptoKey()).toBe(false)
    expect(await loadSessionCryptoKey()).not.toBeNull()
  })

  it('loadSessionCryptoKey returns null for missing or corrupt values', async () => {
    expect(await loadSessionCryptoKey()).toBeNull()

    sessionStorage.setItem('llm-playground-session-key', '%%%not-base64%%%')
    expect(await loadSessionCryptoKey()).toBeNull()
  })
})
