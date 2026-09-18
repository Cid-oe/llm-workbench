import {
  clearSessionCryptoKey,
  decryptJson,
  encryptJson,
  loadSessionCryptoKey,
  purgeLegacyPersistedCryptoKey,
  saveSessionCryptoKey,
  type ApiKeysPayload,
  type EncryptedPayload,
} from '~/lib/crypto'
import { localStore, sessionStore } from '~/lib/browserStorage'
import { readCombinedProviderPersist } from '~/lib/providerPersist'

export { localStore, sessionStore }

/** AES-GCM encrypt the API-key payload. Stores persist the result; they do not call Web Crypto. */
export function encryptKeys(key: CryptoKey, payload: ApiKeysPayload): Promise<EncryptedPayload> {
  return encryptJson(key, payload)
}

export function decryptKeys(key: CryptoKey, payload: EncryptedPayload): Promise<ApiKeysPayload> {
  return decryptJson<ApiKeysPayload>(key, payload)
}

/** Persist the derived AES key in sessionStorage only (never localStorage — #21). */
export function persistSessionCryptoKey(key: CryptoKey): Promise<void> {
  return saveSessionCryptoKey(key)
}

/** Restore the tab session key. Does not read the pre-#21 localStorage vault key. */
export function restoreSessionCryptoKey(): Promise<CryptoKey | null> {
  return loadSessionCryptoKey()
}

export function dropSessionCryptoKey(): void {
  clearSessionCryptoKey()
}

/** Drop any pre-#21 raw AES key left in localStorage. Never used for unlock. */
export function purgeLegacyVaultKey(): void {
  purgeLegacyPersistedCryptoKey()
}

/** Plaintext keys from the pre-encryption `provider` persist blob, if any. */
export function readLegacyPlaintextKeys(): ApiKeysPayload | null {
  const combined = readCombinedProviderPersist()
  if (!combined) return null

  const openaiKey = typeof combined.openaiKey === 'string' ? combined.openaiKey : ''
  const anthropicKey = typeof combined.anthropicKey === 'string' ? combined.anthropicKey : ''
  const geminiKey = typeof combined.geminiKey === 'string' ? combined.geminiKey : ''
  const groqKey = typeof combined.groqKey === 'string' ? combined.groqKey : ''

  if (!openaiKey && !anthropicKey && !geminiKey && !groqKey) return null

  return { openaiKey, anthropicKey, geminiKey, groqKey }
}
