// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GenerationControls from '../../app/components/playground/GenerationControls.vue'
import { usePromptStore } from '../../app/stores/usePromptStore'

const uiStubs = {
  UiCard: { template: '<div><slot /></div>' },
  UiLabel: { template: '<label><slot /></label>' },
  UiInput: {
    template: '<input :value="modelValue" :type="type" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'type', 'min', 'max', 'step'],
    emits: ['update:modelValue'],
  },
}

describe('GenerationControls', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }))
  })

  it('renders temperature and max tokens controls', () => {
    const wrapper = mount(GenerationControls, {
      global: { stubs: uiStubs },
    })
    expect(wrapper.text()).toContain('Generation')
    expect(wrapper.text()).toContain('Temperature')
    expect(wrapper.text()).toContain('Max tokens')
    expect(wrapper.find('#gen-temperature').exists()).toBe(true)
    expect(wrapper.find('#gen-max-tokens').exists()).toBe(true)
  })

  it('updates the prompt store when values change', async () => {
    const wrapper = mount(GenerationControls, {
      global: { stubs: uiStubs },
    })
    const store = usePromptStore()

    await wrapper.find('#gen-temperature').setValue('0.3')
    await wrapper.find('#gen-max-tokens').setValue('512')

    expect(store.generation.temperature).toBe(0.3)
    expect(store.generation.maxTokens).toBe(512)
  })
})
