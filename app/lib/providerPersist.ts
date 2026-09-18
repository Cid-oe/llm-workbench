import type { EncryptedPayload } from '~/lib/crypto'

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
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(COMBINED_PROVIDER_PERSIST_KEY)
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
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(PROVIDER_PERSIST_SPLIT_FLAG) === '1'
}

export function markProviderPersistSplit(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PROVIDER_PERSIST_SPLIT_FLAG, '1')
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as EncryptedPayload
  return payload.v === 1 && typeof payload.iv === 'string' && typeof payload.data === 'string'
}
