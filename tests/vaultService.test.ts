// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from 'vitest'
import {
  deriveKey,
  generateSalt,
  hasLegacyPersistedCryptoKey,
  parseSalt,
  type ApiKeysPayload,
} from '../app/lib/crypto'
import {
  COMBINED_PROVIDER_PERSIST_KEY,
  PROVIDER_PERSIST_SPLIT_FLAG,
} from '../app/lib/providerPersist'
import {
  decryptKeys,
  dropSessionCryptoKey,
  encryptKeys,
  persistSessionCryptoKey,
  purgeLegacyVaultKey,
  readLegacyPlaintextKeys,
  restoreSessionCryptoKey,
} from '../app/lib/vaultService'

const sampleKeys: ApiKeysPayload = {
  openaiKey: 'sk-service',
  anthropicKey: 'sk-ant-service',
  geminiKey: '',
  groqKey: '',
}

async function derivedKey() {
  return deriveKey('vault-service-pass', parseSalt(generateSalt()))
}

describe('vaultService', () => {
  beforeEach(() => {
    dropSessionCryptoKey()
    localStorage.removeItem(COMBINED_PROVIDER_PERSIST_KEY)
    localStorage.removeItem(PROVIDER_PERSIST_SPLIT_FLAG)
  })

  it('encrypts API keys so plaintext is not stored in the payload', async () => {
    const key = await derivedKey()
    const payload = await encryptKeys(key, sampleKeys)

    expect(payload.v).toBe(1)
    expect(payload.iv).toBeTruthy()
    expect(payload.data).toBeTruthy()
    expect(JSON.stringify(payload)).not.toContain('sk-service')
    await expect(decryptKeys(key, payload)).resolves.toEqual(sampleKeys)
  })

  it('persists the CryptoKey in sessionStorage only', async () => {
    const key = await derivedKey()
    await persistSessionCryptoKey(key)

    expect(await restoreSessionCryptoKey()).not.toBeNull()
    expect(localStorage.getItem('llm-playground-vault-key')).toBeNull()
    expect(hasLegacyPersistedCryptoKey()).toBe(false)

    const restored = await restoreSessionCryptoKey()
    const roundTrip = await encryptKeys(restored!, sampleKeys)
    await expect(decryptKeys(restored!, roundTrip)).resolves.toEqual(sampleKeys)
  })

  it('never auto-unlocks from a pre-#21 localStorage CryptoKey', async () => {
    const key = await derivedKey()
    await persistSessionCryptoKey(key)
    const encoded = sessionStorage.getItem('llm-playground-session-key')
    expect(encoded).toBeTruthy()

    sessionStorage.removeItem('llm-playground-session-key')
    localStorage.setItem('llm-playground-vault-key', encoded!)

    expect(await restoreSessionCryptoKey()).toBeNull()
    expect(hasLegacyPersistedCryptoKey()).toBe(true)
  })

  it('purgeLegacyVaultKey drops the localStorage key and leaves the session key', async () => {
    const key = await derivedKey()
    await persistSessionCryptoKey(key)
    localStorage.setItem('llm-playground-vault-key', 'stale')

    purgeLegacyVaultKey()

    expect(hasLegacyPersistedCryptoKey()).toBe(false)
    expect(await restoreSessionCryptoKey()).not.toBeNull()
  })

  it('reads plaintext keys from the legacy provider persist blob', () => {
    localStorage.setItem(COMBINED_PROVIDER_PERSIST_KEY, JSON.stringify({
      state: {
        openaiKey: 'legacy-openai',
        anthropicKey: 'legacy-anthropic',
        geminiKey: '',
        groqKey: '',
      },
    }))

    expect(readLegacyPlaintextKeys()).toEqual({
      openaiKey: 'legacy-openai',
      anthropicKey: 'legacy-anthropic',
      geminiKey: '',
      groqKey: '',
    })
  })

  it('ignores a combined persist blob that only has an encrypted payload', () => {
    localStorage.setItem(COMBINED_PROVIDER_PERSIST_KEY, JSON.stringify({
      encryptedPayload: { v: 1, iv: 'iv', data: 'cipher' },
    }))

    expect(readLegacyPlaintextKeys()).toBeNull()
  })
})
