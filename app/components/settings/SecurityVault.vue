<script setup lang="ts">
import { KeyRound, Lock, Shield, Unlock } from '@lucide/vue'

const securityStore = useSecurityStore()

const password = ref('')
const confirmPassword = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')
const error = ref('')
const notice = ref('')
const loading = ref(false)
const showChangePassword = ref(false)

async function handleSetup() {
  error.value = ''
  notice.value = ''
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }
  loading.value = true
  try {
    await securityStore.setupMasterPassword(password.value)
    password.value = ''
    confirmPassword.value = ''
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to set password'
  }
  finally {
    loading.value = false
  }
}

async function handleUnlock() {
  error.value = ''
  notice.value = ''
  loading.value = true
  try {
    const ok = await securityStore.unlock(password.value)
    if (!ok) error.value = 'Incorrect master password'
    else password.value = ''
  }
  finally {
    loading.value = false
  }
}

function handleLock() {
  securityStore.lock()
  password.value = ''
  error.value = ''
  notice.value = ''
  showChangePassword.value = false
  resetChangeForm()
}

function resetChangeForm() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmNewPassword.value = ''
}

async function handleChangePassword() {
  error.value = ''
  notice.value = ''
  if (newPassword.value !== confirmNewPassword.value) {
    error.value = 'New passwords do not match'
    return
  }
  loading.value = true
  try {
    const ok = await securityStore.changeMasterPassword(currentPassword.value, newPassword.value)
    if (!ok) {
      error.value = 'Current master password is incorrect'
      return
    }
    resetChangeForm()
    showChangePassword.value = false
    notice.value = 'Master password updated. Encrypted keys were re-wrapped with the new password.'
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to change password'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UiCard class="p-4">
    <div class="flex items-start gap-3 mb-4">
      <Shield class="h-5 w-5 text-primary mt-0.5 shrink-0" />
      <div>
        <p class="text-sm font-medium">Encrypted API key vault</p>
        <p class="text-xs text-muted-foreground mt-1">
          Lock hides API keys from view in Settings. Compare keeps using them in the background.
        </p>
      </div>
    </div>

    <div v-if="!securityStore.hasMasterPassword" class="space-y-3">
      <p class="text-sm text-muted-foreground">Set a master password to persist your API keys securely across sessions.</p>
      <div>
        <UiLabel class="mb-1.5 block">Master password</UiLabel>
        <UiInput v-model="password" type="password" placeholder="Min. 8 characters" />
      </div>
      <div>
        <UiLabel class="mb-1.5 block">Confirm password</UiLabel>
        <UiInput v-model="confirmPassword" type="password" placeholder="Repeat password" />
      </div>
      <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
      <UiButton :disabled="loading || !password" @click="handleSetup">
        <Lock class="h-4 w-4" />
        Create vault
      </UiButton>
    </div>

    <div v-else-if="securityStore.isLocked" class="space-y-3">
      <UiBadge variant="warning">Vault locked</UiBadge>
      <div>
        <UiLabel class="mb-1.5 block">Master password</UiLabel>
        <UiInput
          v-model="password"
          type="password"
          placeholder="Enter master password"
          @keyup.enter="handleUnlock"
        />
      </div>
      <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
      <UiButton :disabled="loading || !password" @click="handleUnlock">
        <Unlock class="h-4 w-4" />
        Unlock vault
      </UiButton>
    </div>

    <div v-else class="space-y-3">
      <UiBadge variant="success">Vault unlocked</UiBadge>
      <p class="text-xs text-muted-foreground">
        Key values are visible. Lock to hide them from view when sharing your screen.
      </p>
      <p v-if="notice" class="text-xs text-emerald-600 dark:text-emerald-400">{{ notice }}</p>
      <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
      <div class="flex flex-wrap gap-2">
        <UiButton variant="outline" @click="handleLock">
          <Lock class="h-4 w-4" />
          Lock vault
        </UiButton>
        <UiButton
          variant="outline"
          @click="showChangePassword = !showChangePassword; error = ''; notice = ''"
        >
          <KeyRound class="h-4 w-4" />
          {{ showChangePassword ? 'Cancel' : 'Change master password' }}
        </UiButton>
      </div>

      <div v-if="showChangePassword" class="space-y-3 rounded-md border border-border p-3">
        <div>
          <UiLabel class="mb-1.5 block">Current password</UiLabel>
          <UiInput v-model="currentPassword" type="password" placeholder="Current master password" />
        </div>
        <div>
          <UiLabel class="mb-1.5 block">New password</UiLabel>
          <UiInput v-model="newPassword" type="password" placeholder="Min. 8 characters" />
        </div>
        <div>
          <UiLabel class="mb-1.5 block">Confirm new password</UiLabel>
          <UiInput v-model="confirmNewPassword" type="password" placeholder="Repeat new password" />
        </div>
        <UiButton
          :disabled="loading || !currentPassword || !newPassword"
          @click="handleChangePassword"
        >
          <KeyRound class="h-4 w-4" />
          Update password
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>
