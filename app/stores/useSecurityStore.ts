import { defineStore } from 'pinia'
import {
  deriveKey,
  generateSalt,
  hashPassword,
  parseSalt,
  verifyPassword,
  type ApiKeysPayload,
} from '~/lib/crypto'
import { localStore } from '~/lib/browserStorage'
import {
  dropSessionCryptoKey,
  persistSessionCryptoKey,
  purgeLegacyVaultKey,
  restoreSessionCryptoKey,
} from '~/lib/vaultService'
import { useVaultStore } from './useVaultStore'

export const useSecurityStore = defineStore('security', {
  state: () => ({
    salt: '',
    passwordVerifier: '',
    /** Controls whether API key values are visible/editable in Settings UI */
    isUnlocked: false,
    _cryptoKey: null as CryptoKey | null,
  }),

  getters: {
    hasMasterPassword(state): boolean {
      return !!state.passwordVerifier
    },

    isLocked(state): boolean {
      return !!state.passwordVerifier && !state.isUnlocked
    },

    /** Hide key values in Settings when vault exists and UI is locked */
    hideKeyValues(state): boolean {
      return !!state.passwordVerifier && !state.isUnlocked
    },
  },

  actions: {
    async setupMasterPassword(password: string) {
      if (password.length < 8) {
        throw new Error('Master password must be at least 8 characters')
      }

      const salt = generateSalt()
      const verifier = await hashPassword(password, salt)
      const key = await deriveKey(password, parseSalt(salt))

      this.salt = salt
      this.passwordVerifier = verifier
      this._cryptoKey = key
      this.isUnlocked = true

      await persistSessionCryptoKey(key)
      await useVaultStore().encryptAndPersistKeys()
    },

    async unlock(password: string): Promise<boolean> {
      const valid = await verifyPassword(password, this.salt, this.passwordVerifier)
      if (!valid) return false

      const key = await deriveKey(password, parseSalt(this.salt))
      this._cryptoKey = key
      this.isUnlocked = true
      await persistSessionCryptoKey(key)

      const vault = useVaultStore()
      if (vault.encryptedPayload) {
        await vault.decryptKeys(key)
      }
      return true
    },

    /** Hide keys in UI only — keys stay in memory and keep working */
    lock() {
      this.isUnlocked = false
    },

    getCryptoKey(): CryptoKey | null {
      return this._cryptoKey
    },

    async changeMasterPassword(currentPassword: string, newPassword: string): Promise<boolean> {
      const valid = await verifyPassword(currentPassword, this.salt, this.passwordVerifier)
      if (!valid) return false
      if (newPassword.length < 8) {
        throw new Error('Master password must be at least 8 characters')
      }

      const salt = generateSalt()
      const verifier = await hashPassword(newPassword, salt)
      const key = await deriveKey(newPassword, parseSalt(salt))

      this.salt = salt
      this.passwordVerifier = verifier
      this._cryptoKey = key
      this.isUnlocked = true

      // Drop the previous session key before writing the rotated one.
      dropSessionCryptoKey()
      await persistSessionCryptoKey(key)
      await useVaultStore().encryptAndPersistKeys()
      return true
    },

    /** Restore sessionStorage key only — cold starts require an explicit unlock */
    async bootstrapKeys(): Promise<void> {
      const vault = useVaultStore()
      const hasAnyKey = !!(
        vault.openaiKey
        || vault.anthropicKey
        || vault.geminiKey
        || vault.groqKey
      )

      if (!this.hasMasterPassword) return

      // Drop any pre-#21 raw key left in localStorage; never auto-load from it.
      purgeLegacyVaultKey()
      const cryptoKey = await restoreSessionCryptoKey()
      if (!cryptoKey) return

      this._cryptoKey = cryptoKey

      if (!hasAnyKey && vault.encryptedPayload) {
        await vault.decryptKeys(cryptoKey)
      }
    },
  },

  persist: {
    pick: ['salt', 'passwordVerifier'],
    storage: localStore,
  },
})

export type { ApiKeysPayload }
