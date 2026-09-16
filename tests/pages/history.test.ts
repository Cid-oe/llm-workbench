import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HistoryPage from '../../app/pages/history.vue'
import { usePromptStore } from '../../app/stores/usePromptStore'

const uiStubs = {
  UiButton: {
    template: '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'variant', 'size'],
    emits: ['click'],
  },
  UiCard: { template: '<div @click="$emit(\'click\')"><slot /></div>', emits: ['click'] },
  UiBadge: { template: '<span><slot /></span>', props: ['variant'] },
}

describe('pages/history backup', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }))
    vi.restoreAllMocks()
  })

  function mountPage() {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    setActivePinia(pinia)
    const wrapper = mount(HistoryPage, {
      global: { plugins: [pinia], stubs: uiStubs },
    })
    return { wrapper, promptStore: usePromptStore() }
  }

  it('renders export/import controls', () => {
    const { wrapper } = mountPage()
    expect(wrapper.text()).toContain('Export JSON')
    expect(wrapper.text()).toContain('Import JSON')
  })

  it('imports a JSON backup with replace mode', async () => {
    window.confirm = vi.fn().mockReturnValueOnce(true) // replace

    const { wrapper, promptStore } = mountPage()
    promptStore.history = [{
      id: 'old',
      systemPrompt: 'old',
      userPrompt: 'old',
      variables: {},
      models: [],
      responses: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    }]

    const backup = {
      version: 1,
      exportedAt: '2026-09-16T12:00:00.000Z',
      history: [{
        id: 'new-h',
        systemPrompt: 'Sys',
        userPrompt: 'Imported prompt',
        variables: { topic: 'x' },
        models: [],
        responses: [],
        createdAt: '2026-09-16T11:00:00.000Z',
      }],
      savedPrompts: [{
        id: 'new-s',
        name: 'Pack',
        systemPrompt: 'Sys',
        userPrompt: 'Saved',
        tags: [],
        version: 1,
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
        variables: {},
        revisions: [],
      }],
    }

    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [{ text: async () => JSON.stringify(backup) }],
    })
    await input.trigger('change')
    await flushPromises()

    expect(promptStore.history).toHaveLength(1)
    expect(promptStore.history[0]?.id).toBe('new-h')
    expect(promptStore.savedPrompts).toHaveLength(1)
    expect(wrapper.text()).toMatch(/imported 1 history entry/i)
  })
})
