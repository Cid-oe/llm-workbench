import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSessionCryptoKey,
  decryptJson,
  deriveKey,
  encryptJson,
  generateSalt,
  hashPassword,
  loadPersistedCryptoKey,
  loadSessionCryptoKey,
  parseSalt,
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

  it('persists and reloads the session crypto key from session and local storage', async () => {
    const key = await deriveKey('session-pass', parseSalt(generateSalt()))
    await saveSessionCryptoKey(key)

    const fromSession = await loadSessionCryptoKey()
    const fromPersisted = await loadPersistedCryptoKey()
    expect(fromSession).not.toBeNull()
    expect(fromPersisted).not.toBeNull()

    const roundTrip = await encryptJson(fromSession!, sampleKeys)
    await expect(decryptJson<ApiKeysPayload>(fromPersisted!, roundTrip)).resolves.toEqual(sampleKeys)
  })

  it('clearSessionCryptoKey removes both storages', async () => {
    const key = await deriveKey('session-pass', parseSalt(generateSalt()))
    await saveSessionCryptoKey(key)
    clearSessionCryptoKey()

    expect(await loadSessionCryptoKey()).toBeNull()
    expect(await loadPersistedCryptoKey()).toBeNull()
  })

  it('load helpers return null for missing or corrupt storage values', async () => {
    expect(await loadSessionCryptoKey()).toBeNull()
    expect(await loadPersistedCryptoKey()).toBeNull()

    sessionStorage.setItem('llm-playground-session-key', '%%%not-base64%%%')
    expect(await loadSessionCryptoKey()).toBeNull()
  })
})
