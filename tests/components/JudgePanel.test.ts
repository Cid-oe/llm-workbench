// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import JudgePanel from '../../app/components/playground/JudgePanel.vue'
import { usePromptStore } from '../../app/stores/usePromptStore'

const uiStubs = {
  UiButton: {
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
  UiCard: { template: '<div><slot /></div>' },
  UiInput: {
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue'],
    emits: ['update:modelValue'],
  },
  UiLabel: { template: '<label><slot /></label>' },
}

describe('JudgePanel', () => {
  it('stays collapsed when judge is disabled (smoke)', () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    setActivePinia(pinia)
    const wrapper = mount(JudgePanel, {
      global: { plugins: [pinia], stubs: uiStubs },
    })
    const store = usePromptStore()
    expect(store.judge.enabled).toBe(false)
    expect(wrapper.text()).toContain('LLM-as-a-Judge')
    expect(wrapper.text()).not.toContain('Evaluator provider')
  })

  it('shows evaluator controls when enabled', async () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    setActivePinia(pinia)
    const store = usePromptStore()
    store.patchJudge({ enabled: true })
    const wrapper = mount(JudgePanel, {
      global: { plugins: [pinia], stubs: uiStubs },
    })
    expect(wrapper.text()).toContain('Evaluator provider')
    expect(wrapper.text()).toContain('Rubrics')
    expect(wrapper.find('input').exists()).toBe(true)
  })
})
