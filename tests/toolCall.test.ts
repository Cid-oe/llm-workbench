import { describe, expect, it } from 'vitest'
import {
  buildToolFollowUpMessages,
  detectToolCalls,
  flattenMessagesForLegacyPrompt,
  matchRegisteredTool,
} from '../app/lib/toolCall'

describe('toolCall', () => {
  it('detects OpenAI-style tool_calls payloads', () => {
    const content = JSON.stringify({
      tool_calls: [
        {
          id: 'call_1',
          function: { name: 'get_weather', arguments: '{"city":"Madrid"}' },
        },
      ],
    })
    const calls = detectToolCalls(content)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.name).toBe('get_weather')
    expect(calls[0]?.argumentsJson).toContain('Madrid')
  })

  it('detects a single name/arguments tool payload', () => {
    const calls = detectToolCalls('```json\n{"name":"lookup","arguments":{"q":"hi"}}\n```')
    expect(calls[0]?.name).toBe('lookup')
  })

  it('matches registered tool signatures', () => {
    const call = detectToolCalls('{"name":"lookup","arguments":{}}')[0]!
    expect(matchRegisteredTool(call, [{ id: '1', name: 'lookup' }])?.name).toBe('lookup')
    expect(matchRegisteredTool(call, [{ id: '1', name: 'other' }])).toBeUndefined()
  })

  it('builds follow-up messages and flattens them for legacy prompts', () => {
    const messages = buildToolFollowUpMessages({
      systemPrompt: 'sys',
      userPrompt: 'user',
      assistantContent: '{"name":"lookup","arguments":{}}',
      toolName: 'lookup',
      mockResultJson: '{"answer":42}',
    })
    expect(messages.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'tool'])
    const flat = flattenMessagesForLegacyPrompt(messages)
    expect(flat.systemPrompt).toBe('sys')
    expect(flat.userPrompt).toContain('Tool (lookup)')
    expect(flat.userPrompt).toContain('"answer":42')
  })
})
