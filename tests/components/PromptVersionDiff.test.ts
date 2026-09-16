import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import PromptVersionDiff from '../../app/components/playground/PromptVersionDiff.vue'
import { usePromptStore } from '../../app/stores/usePromptStore'

describe('PromptVersionDiff', () => {
  it('shows empty state without snapshots', () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    setActivePinia(pinia)
    const wrapper = mount(PromptVersionDiff, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('Save a prompt or run Compare')
  })

  it('highlights added and removed editor drift against a saved version', async () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    setActivePinia(pinia)
    const store = usePromptStore()
    store.systemPrompt = 'You are v1'
    store.userPrompt = 'Ask about cats'
    store.savePrompt('Pets')
    store.userPrompt = 'Ask about dogs'

    const wrapper = mount(PromptVersionDiff, { global: { plugins: [pinia] } })
    await wrapper.get('select').setValue(store.promptSnapshots[0]!.id)

    expect(wrapper.text()).toContain('- Ask about cats')
    expect(wrapper.text()).toContain('+ Ask about dogs')
  })
})
