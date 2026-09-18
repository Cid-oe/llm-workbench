// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResponseDiff from '../../app/components/playground/ResponseDiff.vue'
import type { ModelResponse } from '../../app/types/llm'

const uiStubs = {
  UiCard: { template: '<div><slot /></div>' },
  UiButton: {
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    props: ['variant', 'size'],
    emits: ['click'],
  },
}

function doneResponse(slotId: string, modelId: string, content: string): ModelResponse {
  return {
    slotId,
    provider: 'openai',
    modelId,
    content,
    status: 'done',
    metrics: { latencyMs: 10, ttftMs: 1, inputTokens: 1, outputTokens: 1, costUsd: 0 },
  }
}

describe('ResponseDiff', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }))
  })

  it('diffs two completed responses in unified and split modes', async () => {
    const responses = [
      doneResponse('slot-1', 'gpt-4o-mini', 'hello\nworld'),
      doneResponse('slot-2', 'gpt-4o', 'hello\nthere'),
      {
        ...doneResponse('slot-3', 'gpt-4o', 'streaming'),
        status: 'streaming' as const,
      },
    ]

    const wrapper = mount(ResponseDiff, {
      props: { responses },
      global: { stubs: uiStubs },
    })

    expect(wrapper.text()).toContain('Response diff')
    expect(wrapper.text()).toContain('Line-level LCS')
    // Only done responses in selectors
    const options = wrapper.findAll('select option').map(o => o.text())
    expect(options.some(t => t.includes('GPT-4o Mini') || t.includes('gpt-4o-mini'))).toBe(true)
    expect(wrapper.text()).not.toMatch(/Waiting for first token/)

    // Unified shows +/- markers
    expect(wrapper.text()).toContain('- world')
    expect(wrapper.text()).toContain('+ there')

    const splitBtn = wrapper.findAll('button').find(b => b.text().includes('Side-by-side'))
    await splitBtn!.trigger('click')
    expect(wrapper.text()).toContain('world')
    expect(wrapper.text()).toContain('there')
  })

  it('hides when fewer than two done responses exist', () => {
    const wrapper = mount(ResponseDiff, {
      props: {
        responses: [
          doneResponse('slot-1', 'gpt-4o-mini', 'only one'),
          { ...doneResponse('slot-2', 'gpt-4o', ''), status: 'error' as const, error: 'boom' },
        ],
      },
      global: { stubs: uiStubs },
    })
    expect(wrapper.text()).not.toContain('Response diff')
  })
})
