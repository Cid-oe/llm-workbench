// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

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

describe('pages/history', () => {
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
    window.confirm = vi.fn().mockReturnValueOnce(true)

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

  it('switches tabs and clears history from the UI', async () => {
    const { wrapper, promptStore } = mountPage()
    promptStore.$patch({
      history: [{
        id: 'h1',
        systemPrompt: 'Sys',
        userPrompt: 'History prompt',
        variables: { topic: 't' },
        models: [],
        responses: [],
        createdAt: '2026-09-16T11:00:00.000Z',
      }],
      savedPrompts: [{
        id: 's1',
        name: 'Library',
        systemPrompt: 'Sys',
        userPrompt: 'Saved prompt',
        tags: [],
        version: 1,
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
        variables: {},
        revisions: [],
      }],
    })
    await flushPromises()

    expect(wrapper.text()).toContain('History prompt')
    const savedTab = wrapper.findAll('button').find(b => b.text().includes('Saved'))
    await savedTab!.trigger('click')
    expect(wrapper.text()).toContain('Library')

    const historyTab = wrapper.findAll('button').find(b => b.text().includes('History'))
    await historyTab!.trigger('click')
    const clearBtn = wrapper.findAll('button').find(b => b.text().includes('Clear history'))
    await clearBtn!.trigger('click')
    expect(promptStore.history).toHaveLength(0)
  })

  it('loads a history entry into the prompt store', async () => {
    const { wrapper, promptStore } = mountPage()
    promptStore.$patch({
      history: [{
        id: 'h1',
        systemPrompt: 'From history',
        userPrompt: 'Click me',
        variables: { topic: 'loaded' },
        models: [],
        responses: [{
          slotId: 'slot-1',
          provider: 'openai',
          modelId: 'gpt-4o-mini',
          content: 'out',
          status: 'done',
          metrics: { latencyMs: 1, ttftMs: 1, inputTokens: 1, outputTokens: 1, costUsd: 0 },
        }],
        createdAt: '2026-09-16T11:00:00.000Z',
      }],
      systemPrompt: 'other',
    })
    await flushPromises()

    const clickable = wrapper.findAll('div').filter(d => d.text().includes('Click me')).at(-1)
    expect(clickable).toBeTruthy()
    await clickable!.trigger('click')
    expect(promptStore.systemPrompt).toBe('From history')
    expect(promptStore.variables.topic).toBe('loaded')
  })

  it('shows assertion PASS/FAIL badges on history entries', async () => {
    const { wrapper, promptStore } = mountPage()
    promptStore.$patch({
      history: [
        {
          id: 'pass-h',
          systemPrompt: 'Sys',
          userPrompt: 'Passed run',
          variables: {},
          models: [],
          responses: [],
          assertionSummary: 'pass',
          createdAt: '2026-09-16T11:00:00.000Z',
        },
        {
          id: 'fail-h',
          systemPrompt: 'Sys',
          userPrompt: 'Failed run',
          variables: {},
          models: [],
          responses: [],
          assertionSummary: 'fail',
          createdAt: '2026-09-16T10:00:00.000Z',
        },
      ],
    })
    await flushPromises()

    expect(wrapper.text()).toContain('PASS')
    expect(wrapper.text()).toContain('FAIL')
  })

  it('exports JSON backup via download click', async () => {
    const { wrapper, promptStore } = mountPage()
    promptStore.$patch({
      history: [{
        id: 'h1',
        systemPrompt: 'Sys',
        userPrompt: 'Export me',
        variables: {},
        models: [],
        responses: [],
        createdAt: '2026-09-16T11:00:00.000Z',
      }],
    })

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.fn()
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag)
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: click })
      }
      return el
    })

    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Export JSON'))
    await exportBtn!.trigger('click')
    await flushPromises()

    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup')
    expect(wrapper.text()).toMatch(/Backup exported/i)
  })

  it('deletes a saved prompt from the library tab', async () => {
    const { wrapper, promptStore } = mountPage()
    promptStore.$patch({
      savedPrompts: [{
        id: 's1',
        name: 'Delete me',
        systemPrompt: 'Sys',
        userPrompt: 'Saved prompt',
        tags: ['demo'],
        version: 1,
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
        variables: {},
        revisions: [],
      }],
    })
    await flushPromises()

    const savedTab = wrapper.findAll('button').find(b => b.text().includes('Saved'))
    await savedTab!.trigger('click')
    expect(wrapper.text()).toContain('Delete me')

    // Delete control is icon-only (Trash2), so the button text is empty
    const deleteBtn = wrapper.findAll('button').find(b => b.text().trim() === '')
    expect(deleteBtn).toBeTruthy()
    await deleteBtn!.trigger('click')
    expect(promptStore.savedPrompts).toHaveLength(0)
  })

  it('downloads a .prompt file for a saved prompt', async () => {
    const { wrapper, promptStore } = mountPage()
    promptStore.$patch({
      savedPrompts: [{
        id: 's1',
        name: 'Pack',
        systemPrompt: 'Sys',
        userPrompt: 'Saved body',
        tags: [],
        version: 2,
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
        variables: {},
        revisions: [],
      }],
    })
    await flushPromises()

    const savedTab = wrapper.findAll('button').find(b => b.text().includes('Saved'))
    await savedTab!.trigger('click')

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prompt')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.fn()
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag)
      if (tag === 'a') Object.defineProperty(el, 'click', { value: click })
      return el
    })

    const downloadBtn = wrapper.findAll('button').find(b => b.text().includes('.prompt'))
    await downloadBtn!.trigger('click')

    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:prompt')
  })
})
