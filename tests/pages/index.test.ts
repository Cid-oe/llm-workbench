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
  UiDialog: { template: '<div v-if="open"><slot /></div>', props: ['open', 'title'] },
  UiLabel: { template: '<label><slot /></label>' },
  UiInput: {
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
  },
  PlaygroundPromptEditor: true,
  PlaygroundVariablesInput: true,
  PlaygroundModelSelector: true,
  PlaygroundComparisonGrid: true,
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

    const runBtn = wrapper.findAll('button').find(b => b.text().includes('Run All'))
    expect(runBtn).toBeTruthy()
    await runBtn!.trigger('click')
    await flushPromises()

    expect(streamCompletion).toHaveBeenCalledTimes(1)
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
})
