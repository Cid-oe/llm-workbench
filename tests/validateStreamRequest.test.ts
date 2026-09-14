import { describe, expect, it } from 'vitest'
import { isAllowedUrl, isProviderId, validateStreamRequest } from '../app/lib/validateStreamRequest'

describe('validateStreamRequest', () => {
  const valid = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    systemPrompt: 'Sys',
    userPrompt: 'Hi',
    apiKey: 'sk-test',
  }

  it('accepts a well-formed OpenAI request', () => {
    const result = validateStreamRequest(valid)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.model).toBe('gpt-4o-mini')
      expect(result.value.provider).toBe('openai')
    }
  })

  it('rejects missing or unknown providers', () => {
    expect(validateStreamRequest({ ...valid, provider: 'azure' }).ok).toBe(false)
    expect(validateStreamRequest({ ...valid, provider: undefined }).ok).toBe(false)
    expect(isProviderId('ollama')).toBe(true)
    expect(isProviderId('azure')).toBe(false)
  })

  it('rejects blank models and non-string prompts', () => {
    expect(validateStreamRequest({ ...valid, model: '  ' }).ok).toBe(false)
    expect(validateStreamRequest({ ...valid, systemPrompt: 1 }).ok).toBe(false)
    expect(validateStreamRequest({ ...valid, userPrompt: null }).ok).toBe(false)
    expect(validateStreamRequest(null).ok).toBe(false)
  })

  it('rejects invalid Ollama URLs', () => {
    expect(isAllowedUrl('http://localhost:11434')).toBe(true)
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false)
    expect(validateStreamRequest({
      provider: 'ollama',
      model: 'llama3.2',
      systemPrompt: '',
      userPrompt: 'Hi',
      ollamaUrl: 'not-a-url',
    }).ok).toBe(false)
  })
})
