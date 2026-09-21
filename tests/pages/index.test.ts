// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { flushPromises, mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IndexPage from '../../app/pages/index.vue'
import { StreamError } from '../../app/lib/errors'
import { usePromptStore } from '../../app/stores/usePromptStore'
import { useProviderStore } from '../../app/stores/useProviderStore'
import { useCostCalculator } from '../../app/composables/useCostCalculator'
import { useCodeExporter } from '../../app/composables/useCodeExporter'

const streamCompletion = vi.fn()

vi.stubGlobal('useLLMStream', () => ({ streamCompletion }))
vi.stubGlobal('useCostCalculator', useCostCalculator)
vi.stubGlobal('useCodeExporter', useCodeExporter)

const uiStubs = {
  UiButton: {
    template: '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'variant', 'size'],
    emits: ['click'],
  },
  UiDialog: { template: '<div v-if="open"><slot /></div>', props: ['open', 'title', 'size'] },
  UiLabel: { template: '<label><slot /></label>' },
  UiInput: {
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
  },
  PlaygroundPromptEditor: true,
  PlaygroundVariablesInput: true,
  PlaygroundGenerationControls: true,
  PlaygroundModelSelector: true,
  PlaygroundComparisonGrid: true,
  PlaygroundPromptVersionDiff: true,
  PlaygroundBulkDatasetPanel: {
    name: 'PlaygroundBulkDatasetPanel',
    props: ['open', 'variables', 'canRun', 'isRunning', 'results', 'progressLabel'],
    emits: ['close', 'start', 'stop', 'clear'],
    template: `<div v-if="open" data-testid="bulk-panel">
      <button type="button" @click="$emit('start', { rows: [{ topic: 'bulk-topic' }], mapping: { topic: 'topic' } })">Start Bulk</button>
    </div>`,
  },
}

describe('pages/index compare run path', () => {
  beforeEach(() => {
    streamCompletion.mockReset()
    streamCompletion.mockImplementation(async (_req, handlers) => {
      handlers.onChunk('Hello')
      handlers.onFirstToken(12)
      handlers.onDone()
    })
  })

  function mountPage() {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    setActivePinia(pinia)

    const providerStore = useProviderStore()
    providerStore.selectedModels = [
      { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
    ]
    providerStore.setApiKey('openai', 'sk-test')

    const wrapper = mount(IndexPage, {
      global: {
        plugins: [pinia],
        stubs: uiStubs,
      },
    })

    return { wrapper, promptStore: usePromptStore(), providerStore }
  }

  it('renders compare heading and disabled run without keys', async () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    setActivePinia(pinia)
    useProviderStore().selectedModels = [
      { slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' },
    ]

    const wrapper = mount(IndexPage, {
      global: { plugins: [pinia], stubs: uiStubs },
    })

    expect(wrapper.text()).toContain('Compare')
    const runBtn = wrapper.findAll('button').find(b => b.text().includes('Run All'))
    expect(runBtn?.attributes('disabled')).toBeDefined()
  })

  it('run all streams completions into the prompt store', async () => {
    const { wrapper, promptStore } = mountPage()
    promptStore.generation = { temperature: 0.25, maxTokens: 300 }

    const runBtn = wrapper.findAll('button').find(b => b.text().includes('Run All'))
    expect(runBtn).toBeTruthy()
    await runBtn!.trigger('click')
    await flushPromises()

    expect(streamCompletion).toHaveBeenCalledTimes(1)
    expect(streamCompletion.mock.calls[0]?.[0]).toMatchObject({
      temperature: 0.25,
      maxTokens: 300,
    })
    expect(promptStore.responses).toHaveLength(1)
    expect(promptStore.responses[0]?.content).toBe('Hello')
    expect(promptStore.responses[0]?.status).toBe('done')
    expect(promptStore.responses[0]?.metrics.outputTokens).toBeGreaterThan(0)
    expect(promptStore.isRunning).toBe(false)
    expect(promptStore.history).toHaveLength(1)
    expect(wrapper.text()).toContain('Responses')
  })

  it('records stream errors on the response', async () => {
    streamCompletion.mockImplementation(async (_req, handlers) => {
      handlers.onError(new StreamError({ message: 'boom', code: 'unknown', provider: 'openai' }))
    })

    const { wrapper, promptStore } = mountPage()
    const runBtn = wrapper.findAll('button').find(b => b.text().includes('Run All'))
    await runBtn!.trigger('click')
    await flushPromises()

    expect(promptStore.responses[0]?.status).toBe('error')
    expect(promptStore.responses[0]?.error).toBe('boom')
  })

  it('exports a .prompt file preview and imports it back', async () => {
    const { wrapper, promptStore, providerStore } = mountPage()
    promptStore.userPrompt = 'Round trip {{topic}}'
    promptStore.generation = { temperature: 0.4 }

    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Export'))
    await exportBtn!.trigger('click')
    const promptTab = wrapper.findAll('button').find(b => b.text().includes('.prompt'))
    await promptTab!.trigger('click')

    expect(wrapper.text()).toContain('Git-friendly Markdown')
    expect(wrapper.text()).toContain('temperature: 0.4')
    expect(wrapper.text()).toContain('gpt-4o-mini')
    expect(wrapper.text()).not.toContain('sk-test')

    const imported = `---
model: gpt-4o
provider: openai
temperature: 0.9
variables:
  topic: imported
---
## System
sys from file
## User
user from file
`
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [{ text: async () => imported }],
    })
    await input.trigger('change')
    await flushPromises()

    expect(promptStore.systemPrompt).toBe('sys from file')
    expect(promptStore.userPrompt).toBe('user from file')
    expect(promptStore.generation.temperature).toBe(0.9)
    expect(providerStore.selectedModels[0]?.modelId).toBe('gpt-4o')
  })

  it('opens the prompt diff dialog', async () => {
    const { wrapper } = mountPage()
    const diffBtn = wrapper.findAll('button').find(b => b.text().includes('Diff'))
    await diffBtn!.trigger('click')
    expect(wrapper.findComponent({ name: 'PlaygroundPromptVersionDiff' }).exists()).toBe(true)
  })

  it('runs a bulk dataset row with interpolated variables', async () => {
    const { wrapper, promptStore } = mountPage()
    promptStore.userPrompt = 'Explain {{topic}}'
    promptStore.variables = { topic: 'default' }

    const bulkBtn = wrapper.findAll('button').find(b => b.text().includes('Bulk'))
    await bulkBtn!.trigger('click')
    expect(wrapper.find('[data-testid="bulk-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="bulk-panel"] button').trigger('click')
    await flushPromises()

    expect(streamCompletion).toHaveBeenCalledTimes(1)
    expect(streamCompletion.mock.calls[0]?.[0]?.userPrompt).toBe('Explain bulk-topic')
    expect(wrapper.findComponent({ name: 'PlaygroundBulkDatasetPanel' }).props('results')).toHaveLength(1)
    expect(wrapper.findComponent({ name: 'PlaygroundBulkDatasetPanel' }).props('results')[0].status).toBe('done')
  })

  it('shows Stop while running and aborts the run', async () => {
    let release!: () => void
    streamCompletion.mockImplementation(() => new Promise<void>((resolve) => {
      release = resolve
    }))

    const { wrapper, promptStore } = mountPage()
    const historyBefore = promptStore.history.length
    const runBtn = wrapper.findAll('button').find(b => b.text().includes('Run All'))
    await runBtn!.trigger('click')
    await flushPromises()

    expect(promptStore.isRunning).toBe(true)
    const stopBtn = wrapper.findAll('button').find(b => b.text().includes('Stop'))
    expect(stopBtn).toBeTruthy()
    await stopBtn!.trigger('click')
    expect(promptStore.isRunning).toBe(false)
    expect(promptStore.responses[0]?.status).toBe('cancelled')
    release()
    await flushPromises()

    expect(promptStore.isRunning).toBe(false)
    expect(promptStore.history.length).toBe(historyBefore)
    expect(promptStore.responses[0]?.status).toBe('cancelled')
  })

  it('saves a named prompt from the Save dialog', async () => {
    const { wrapper, promptStore } = mountPage()
    const saveBtn = wrapper.findAll('button').find(b => b.text() === 'Save' || b.text().includes('Save'))
    await saveBtn!.trigger('click')
    expect(wrapper.text()).toContain('Name')

    const input = wrapper.find('input')
    await input.setValue('My collection')
    const dialogSaves = wrapper.findAll('button').filter(b => b.text() === 'Save')
    await dialogSaves[dialogSaves.length - 1]!.trigger('click')
    expect(promptStore.savedPrompts.some(p => p.name === 'My collection')).toBe(true)
  })

  it('opens the Export dialog code tab and copies the snippet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const { wrapper } = mountPage()
    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Export'))
    await exportBtn!.trigger('click')
    expect(wrapper.text()).toContain('JavaScript (fetch)')
    expect(wrapper.text()).toContain('TypeScript SDK')
    expect(wrapper.text()).toContain('Vercel AI SDK')
    expect(wrapper.text()).toContain('LangChain (TS)')
    expect(wrapper.text()).toContain('fetch(')

    const copyBtn = wrapper.findAll('button').find(b => b.text() === 'Copy')
    await copyBtn!.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalled()
  })
})
