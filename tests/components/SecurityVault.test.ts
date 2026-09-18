// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SecurityVault from '../../app/components/settings/SecurityVault.vue'
import { useSecurityStore } from '../../app/stores/useSecurityStore'
import { useProviderStore } from '../../app/stores/useProviderStore'
import { loadSessionCryptoKey } from '../../app/lib/crypto'
import UiButton from '../../app/components/ui/Button.vue'
import UiInput from '../../app/components/ui/Input.vue'

const uiStubs = {
  UiCard: { template: '<div><slot /></div>' },
  UiButton,
  UiInput,
  UiLabel: { template: '<label><slot /></label>' },
  UiBadge: { template: '<span><slot /></span>', props: ['variant'] },
}

describe('SecurityVault', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  function mountVault() {
    return mount(SecurityVault, { global: { stubs: uiStubs, plugins: [pinia] } })
  }

  it('creates a vault from the setup form', async () => {
    const security = useSecurityStore()
    const wrapper = mountVault()
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('correct-horse')
    await inputs[1]!.setValue('correct-horse')
    await wrapper.findAll('button').find(b => b.text().includes('Create vault'))!.trigger('click')

    await vi.waitFor(() => {
      expect(security.hasMasterPassword).toBe(true)
    })
    expect(security.isUnlocked).toBe(true)
    expect(wrapper.text()).toContain('Vault unlocked')
  })

  it('changes the master password from Settings UI', async () => {
    const security = useSecurityStore()
    const provider = useProviderStore()
    provider.setApiKey('openai', 'sk-live')
    await security.setupMasterPassword('correct-horse')

    const wrapper = mountVault()
    expect(wrapper.text()).toContain('Change master password')

    await wrapper.findAll('button').find(b => b.text().includes('Change master password'))!.trigger('click')
    const inputs = wrapper.findAll('input[type="password"]')
    expect(inputs.length).toBe(3)
    await inputs[0]!.setValue('correct-horse')
    await inputs[1]!.setValue('new-secure-pass')
    await inputs[2]!.setValue('new-secure-pass')
    await wrapper.findAll('button').find(b => b.text().includes('Update password'))!.trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toMatch(/master password updated/i)
    })
    expect(await security.unlock('correct-horse')).toBe(false)
    expect(await security.unlock('new-secure-pass')).toBe(true)
    expect(await loadSessionCryptoKey()).not.toBeNull()
    expect(provider.openaiKey).toBe('sk-live')
  })

  it('rejects mismatched new passwords in the change form', async () => {
    const security = useSecurityStore()
    await security.setupMasterPassword('correct-horse')
    const wrapper = mountVault()

    await wrapper.findAll('button').find(b => b.text().includes('Change master password'))!.trigger('click')
    const inputs = wrapper.findAll('input[type="password"]')
    await inputs[0]!.setValue('correct-horse')
    await inputs[1]!.setValue('new-secure-pass')
    await inputs[2]!.setValue('different-pass')
    await wrapper.findAll('button').find(b => b.text().includes('Update password'))!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toMatch(/do not match/i)
  })
})
