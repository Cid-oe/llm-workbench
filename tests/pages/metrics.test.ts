import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import MetricsPage from '../../app/pages/metrics.vue'
import { usePromptStore } from '../../app/stores/usePromptStore'
import { useCostCalculator } from '../../app/composables/useCostCalculator'
import type { ModelResponse } from '../../app/types/llm'

vi.stubGlobal('useCostCalculator', useCostCalculator)

const sampleResponse = (): ModelResponse => ({
  slotId: 'slot-1',
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  content: 'hi',
  status: 'done',
  metrics: {
    latencyMs: 250,
    ttftMs: 40,
    inputTokens: 20,
    outputTokens: 30,
    costUsd: 0.001,
  },
})

const stubs = {
  UiButton: {
    template: '<button @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
  UiCard: { template: '<div class="ui-card"><slot /></div>' },
  UiBadge: { template: '<span><slot /></span>' },
  MetricsMetricBarChart: true,
  MetricsLatencyTimeline: true,
  Activity: true,
  DollarSign: true,
  Timer: true,
  Zap: true,
}

describe('pages/metrics', () => {
  it('shows empty state with no data', () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    setActivePinia(pinia)

    const wrapper = mount(MetricsPage, {
      global: { plugins: [pinia], stubs },
    })

    expect(wrapper.text()).toContain('No metrics yet.')
    expect(wrapper.text()).toContain('Go to Compare')
  })

  it('renders summary cards and table for latest responses', async () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    setActivePinia(pinia)
    const promptStore = usePromptStore()
    promptStore.responses = [sampleResponse()]
    promptStore.history = [{
      id: 'h1',
      systemPrompt: '',
      userPrompt: 'q',
      variables: {},
      models: [{ slotId: 'slot-1', provider: 'openai', modelId: 'gpt-4o-mini' }],
      responses: [sampleResponse()],
      createdAt: '2026-01-01T00:00:00Z',
    }]

    const wrapper = mount(MetricsPage, {
      global: { plugins: [pinia], stubs },
    })

    expect(wrapper.text()).toContain('Metrics')
    expect(wrapper.text()).toContain('Fastest avg')
    expect(wrapper.text()).toContain('Detailed comparison')
    expect(wrapper.text()).toContain('Results from the most recent run')

    const buttons = wrapper.findAll('button')
    const historical = buttons.find(b => b.text().includes('Historical avg'))
    await historical!.trigger('click')
    expect(wrapper.text()).toContain('Historical averages across all runs')
  })
})
