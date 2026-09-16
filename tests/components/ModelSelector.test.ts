import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ModelSelector from '../../app/components/playground/ModelSelector.vue'
import { useProviderStore } from '../../app/stores/useProviderStore'

const uiStubs = {
  UiCard: { template: '<div><slot /></div>' },
  UiButton: {
    template: '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'variant', 'size'],
    emits: ['click'],
  },
  UiBadge: { template: '<span><slot /></span>', props: ['variant'] },
}

describe('ModelSelector', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }))
  })

  it('shows Refresh Ollama when an ollama slot is selected', () => {
    const wrapper = mount(ModelSelector, { global: { stubs: uiStubs } })
    expect(wrapper.text()).toContain('Refresh Ollama')
  })

  it('refreshes models and shows an error when discovery fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const wrapper = mount(ModelSelector, { global: { stubs: uiStubs } })
    const store = useProviderStore()

    const refreshBtn = wrapper.findAll('button').find(b => b.text().includes('Refresh Ollama'))
    await refreshBtn!.trigger('click')
    await flushPromises()

    expect(store.ollamaDiscoverError).toMatch(/could not reach ollama/i)
    expect(wrapper.text()).toMatch(/could not reach ollama/i)
  })
})
