import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JsonTreeNode from '../../app/components/playground/JsonTreeNode.vue'
import type { JsonPreviewNode } from '../../app/lib/jsonPreview'

describe('JsonTreeNode', () => {
  it('folds and expands nested object nodes', async () => {
    const node: JsonPreviewNode = {
      kind: 'object',
      key: 'root',
      children: [
        { kind: 'primitive', key: 'x', value: '1', type: 'number' },
      ],
    }

    const wrapper = mount(JsonTreeNode, {
      props: { node },
      global: {
        components: { PlaygroundJsonTreeNode: JsonTreeNode },
      },
    })

    expect(wrapper.text()).toContain('x')
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toMatch(/…1/)
    expect(wrapper.text()).not.toContain('x:')
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toContain('x')
  })
})
