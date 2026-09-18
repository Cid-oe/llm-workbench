// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BulkDatasetPanel from '../../app/components/playground/BulkDatasetPanel.vue'

const uiStubs = {
  UiButton: {
    template: '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'variant', 'size'],
    emits: ['click'],
  },
  UiDialog: { template: '<div v-if="open"><slot /></div>', props: ['open', 'title', 'size'] },
}

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(BulkDatasetPanel, {
    props: {
      open: true,
      variables: ['topic', 'audience'],
      canRun: true,
      isRunning: false,
      results: [],
      progressLabel: '',
      ...props,
    },
    global: { stubs: uiStubs },
  })
}

describe('BulkDatasetPanel', () => {
  it('shows parse error for empty CSV', async () => {
    const wrapper = mountPanel()
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [{ name: 'empty.csv', text: async () => 'topic\n' }],
    })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toMatch(/header row and at least one data row/i)
  })

  it('rejects invalid JSON and maps a valid CSV', async () => {
    const wrapper = mountPanel()
    const input = wrapper.get('input[type="file"]')

    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [{ name: 'bad.json', text: async () => '{' }],
    })
    await input.trigger('change')
    await flushPromises()
    expect(wrapper.text()).toMatch(/invalid json/i)

    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [{ name: 'ok.csv', text: async () => 'topic,audience\nquantum,beginner\n' }],
    })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('ok.csv')
    expect(wrapper.text()).toContain('1 rows')
    expect(wrapper.find('select').element.value).toBe('topic')
  })

  it('emits start with mapped rows', async () => {
    const wrapper = mountPanel()
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [{ name: 'ok.csv', text: async () => 'topic,audience\na,b\n' }],
    })
    await input.trigger('change')
    await flushPromises()

    const runBtn = wrapper.findAll('button').find(b => b.text().includes('Run dataset'))
    await runBtn!.trigger('click')

    expect(wrapper.emitted('start')?.[0]?.[0]).toEqual({
      rows: [{ topic: 'a', audience: 'b' }],
      mapping: { topic: 'topic', audience: 'audience' },
    })
  })

  it('blocks run when no dataset is loaded', async () => {
    const wrapper = mountPanel()
    const runBtn = wrapper.findAll('button').find(b => b.text().includes('Run dataset'))
    expect(runBtn?.attributes('disabled')).toBeDefined()
  })
})
