import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JsonStructuredPreview from '../../app/components/playground/JsonStructuredPreview.vue'

const uiStubs = {
  UiButton: {
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    props: ['variant', 'size'],
    emits: ['click'],
  },
  UiBadge: { template: '<span><slot /></span>', props: ['variant'] },
  PlaygroundJsonTreeNode: {
    props: ['node', 'depth'],
    template: '<div data-testid="tree">tree:{{ node.kind }}</div>',
  },
}

describe('JsonStructuredPreview', () => {
  it('shows structured tree for valid JSON and can switch to raw', async () => {
    const wrapper = mount(JsonStructuredPreview, {
      props: { content: '{"hello":"world"}' },
      global: { stubs: uiStubs },
    })

    expect(wrapper.find('[data-testid="tree"]').exists()).toBe(true)
    await wrapper.findAll('button').find(b => b.text() === 'Raw')!.trigger('click')
    expect(wrapper.text()).toContain('{"hello":"world"}')
  })

  it('shows a parse error for invalid JSON-looking content', () => {
    const wrapper = mount(JsonStructuredPreview, {
      props: { content: '{not-json' },
      global: { stubs: uiStubs },
    })

    expect(wrapper.text()).toMatch(/JSON parse error/i)
  })

  it('renders plain text without tabs when content is not JSON-like', () => {
    const wrapper = mount(JsonStructuredPreview, {
      props: { content: 'Hello from the model' },
      global: { stubs: uiStubs },
    })

    expect(wrapper.text()).toContain('Hello from the model')
    expect(wrapper.text()).not.toContain('Structured')
  })
})
