import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import LatencyTimeline from '../../app/components/metrics/LatencyTimeline.vue'
import type { TimelinePoint } from '../../app/lib/metrics'

function mountTimeline(points: TimelinePoint[]) {
  const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
  setActivePinia(pinia)

  return mount(LatencyTimeline, {
    props: { points },
    global: {
      plugins: [pinia],
      stubs: {
        UiCard: { template: '<div class="ui-card"><slot /></div>' },
      },
    },
  })
}

describe('LatencyTimeline', () => {
  it('shows empty state when there are no points', () => {
    const wrapper = mountTimeline([])
    expect(wrapper.text()).toContain('Run comparisons in Compare')
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('renders comparison bars for a single run', () => {
    const wrapper = mountTimeline([
      { date: '2026-01-01T00:00:00Z', modelId: 'gpt-4o-mini', label: 'GPT-4o mini', latencyMs: 200 },
      { date: '2026-01-01T00:00:00Z', modelId: 'llama3.2', label: 'Llama 3.2', latencyMs: 400 },
    ])

    expect(wrapper.text()).toContain('Current run — lower is better')
    expect(wrapper.find('svg[aria-label="Latency chart"]').exists()).toBe(true)
    expect(wrapper.findAll('rect').length).toBe(2)
    expect(wrapper.findAll('polyline').length).toBe(0)
    expect(wrapper.text()).toContain('GPT-4o mini')
    expect(wrapper.text()).toContain('Llama 3.2')
  })

  it('renders timeline lines across multiple runs', () => {
    const wrapper = mountTimeline([
      { date: '2026-01-01T00:00:00Z', modelId: 'gpt-4o-mini', label: 'GPT-4o mini', latencyMs: 200 },
      { date: '2026-01-02T00:00:00Z', modelId: 'gpt-4o-mini', label: 'GPT-4o mini', latencyMs: 300 },
      { date: '2026-01-01T00:00:00Z', modelId: 'llama3.2', label: 'Llama 3.2', latencyMs: 450 },
      { date: '2026-01-02T00:00:00Z', modelId: 'llama3.2', label: 'Llama 3.2', latencyMs: 350 },
    ])

    expect(wrapper.text()).toContain('Recent runs — lower is better')
    expect(wrapper.findAll('polyline').length).toBeGreaterThan(0)
    expect(wrapper.findAll('circle').length).toBeGreaterThan(0)
    expect(wrapper.findAll('rect').length).toBe(0)
  })
})
