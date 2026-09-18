// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { EncryptedPayload } from '~/lib/crypto'
import { VAULT_CRYPTO_VERSION } from '~/lib/crypto'
import { localStore } from '~/lib/browserStorage'

/** Pre-split Pinia persist key used by the combined `provider` store. */
export const COMBINED_PROVIDER_PERSIST_KEY = 'provider'

/** Set after a one-time copy from `provider` into vault/slots/local keys. */
export const PROVIDER_PERSIST_SPLIT_FLAG = 'provider-persist-v2'

export const PROVIDER_PERSIST_KEYS = {
  vault: 'provider-vault',
  slots: 'provider-slots',
  local: 'provider-local',
  session: 'provider-session',
} as const

export function readCombinedProviderPersist(): Record<string, unknown> | null {
  try {
    const raw = localStore.getItem(COMBINED_PROVIDER_PERSIST_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const state = (parsed.state ?? parsed) as Record<string, unknown>
    if (!state || typeof state !== 'object' || Array.isArray(state)) return null
    return state
  }
  catch {
    return null
  }
}

export function hasSplitProviderPersist(): boolean {
  return localStore.getItem(PROVIDER_PERSIST_SPLIT_FLAG) === '1'
}

export function markProviderPersistSplit(): void {
  localStore.setItem(PROVIDER_PERSIST_SPLIT_FLAG, '1')
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as EncryptedPayload
  return payload.v === VAULT_CRYPTO_VERSION && typeof payload.iv === 'string' && typeof payload.data === 'string'
}
