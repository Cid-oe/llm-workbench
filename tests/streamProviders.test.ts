// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { buildProviderRequest, extractTextChunk } from '../app/lib/streamProviders'

describe('streamProviders', () => {
  it('builds OpenAI request with temperature and max_tokens', () => {
    const req = buildProviderRequest({
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      apiKey: 'sk-test',
      temperature: 0.2,
      maxTokens: 256,
    })

    expect(req.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(req.headers.Authorization).toBe('Bearer sk-test')
    expect(req.format).toBe('sse')
    expect(JSON.parse(req.body)).toMatchObject({
      temperature: 0.2,
      max_tokens: 256,
      stream: true,
    })
  })

  it('builds Anthropic request with browser access header and sampling', () => {
    const req = buildProviderRequest({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      apiKey: 'sk-ant-test',
      temperature: 0.5,
      maxTokens: 1024,
    })

    expect(req.url).toContain('anthropic.com')
    expect(req.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(JSON.parse(req.body)).toMatchObject({
      temperature: 0.5,
      max_tokens: 1024,
    })
  })

  it('builds Groq request', () => {
    const req = buildProviderRequest({
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      apiKey: 'gsk-test',
    })

    expect(req.url).toContain('groq.com')
    expect(req.format).toBe('sse')
    expect(JSON.parse(req.body)).toMatchObject({
      temperature: 0.7,
      max_tokens: 4096,
    })
  })

  it('builds Gemini request with generationConfig', () => {
    const req = buildProviderRequest({
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      apiKey: 'AIza-test',
      temperature: 0.1,
      maxTokens: 512,
    })

    expect(req.url).toContain('generativelanguage.googleapis.com')
    expect(req.url).toContain('key=AIza-test')
    expect(JSON.parse(req.body).generationConfig).toEqual({
      temperature: 0.1,
      maxOutputTokens: 512,
    })
  })

  it('builds Ollama NDJSON request with options', () => {
    const req = buildProviderRequest({
      provider: 'ollama',
      model: 'llama3.2',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      ollamaUrl: 'http://localhost:11434',
      temperature: 0.9,
      maxTokens: 128,
    })

    expect(req.url).toBe('http://localhost:11434/api/chat')
    expect(req.format).toBe('ollama')
    expect(JSON.parse(req.body).options).toEqual({
      temperature: 0.9,
      num_predict: 128,
    })
  })

  it('extracts chunks per provider', () => {
    expect(extractTextChunk({
      choices: [{ delta: { content: 'hello' } }],
    }, 'openai')).toBe('hello')

    expect(extractTextChunk({
      type: 'content_block_delta',
      delta: { text: 'hi' },
    }, 'anthropic')).toBe('hi')

    expect(extractTextChunk({
      message: { content: 'local' },
    }, 'ollama')).toBe('local')
  })
})
