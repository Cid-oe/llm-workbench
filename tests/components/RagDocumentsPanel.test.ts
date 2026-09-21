// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import RagDocumentsPanel from '../../app/components/playground/RagDocumentsPanel.vue'
import { useRagStore } from '../../app/stores/useRagStore'

const uiStubs = {
  UiButton: {
    template: '<button v-bind="$attrs" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'variant', 'size'],
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

describe('RagDocumentsPanel', () => {
  it('stays collapsed when RAG is disabled', () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    setActivePinia(pinia)
    const wrapper = mount(RagDocumentsPanel, {
      global: { plugins: [pinia], stubs: uiStubs },
    })
    expect(wrapper.text()).toContain('Context & Documents')
    expect(wrapper.text()).not.toContain('Upload document')
  })

  it('shows upload controls when enabled', () => {
    const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn })
    setActivePinia(pinia)
    useRagStore().enabled = true
    const wrapper = mount(RagDocumentsPanel, {
      global: { plugins: [pinia], stubs: uiStubs },
    })
    expect(wrapper.text()).toContain('Upload document')
    expect(wrapper.text()).toContain('Local (hashed, offline)')
  })
})
