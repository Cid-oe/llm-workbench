// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import {
  discoverOllamaModels,
  ollamaTagsUrl,
  parseOllamaTags,
  staticOllamaModels,
} from '../app/lib/ollamaModels'

describe('ollamaModels', () => {
  it('builds the tags URL without a trailing slash', () => {
    expect(ollamaTagsUrl('http://localhost:11434')).toBe('http://localhost:11434/api/tags')
    expect(ollamaTagsUrl('http://localhost:11434/')).toBe('http://localhost:11434/api/tags')
  })

  it('parses /api/tags payloads into provider models', () => {
    const models = parseOllamaTags({
      models: [
        { name: 'llama3.2:latest' },
        { model: 'mistral:7b' },
        { name: 'llama3.2:latest' },
        { name: '  ' },
        null,
      ],
    })
    expect(models.map(m => m.id)).toEqual(['llama3.2:latest', 'mistral:7b'])
    expect(models.every(m => m.provider === 'ollama')).toBe(true)
  })

  it('discovers live models from a successful fetch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [{ name: 'qwen2.5:7b' }, { name: 'codellama:latest' }],
      }),
    })

    const result = await discoverOllamaModels('http://localhost:11434', fetchImpl as unknown as typeof fetch)

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result.source).toBe('live')
    expect(result.error).toBeUndefined()
    expect(result.models.map(m => m.id)).toEqual(['qwen2.5:7b', 'codellama:latest'])
  })

  it('falls back to the static list when Ollama is unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await discoverOllamaModels('http://localhost:11434', fetchImpl as unknown as typeof fetch)

    expect(result.source).toBe('fallback')
    expect(result.models).toEqual(staticOllamaModels())
    expect(result.error).toMatch(/could not reach ollama/i)
    expect(result.error).toMatch(/OLLAMA_ORIGINS/i)
  })

  it('falls back when the HTTP response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    })
    const result = await discoverOllamaModels('http://127.0.0.1:11434', fetchImpl as unknown as typeof fetch)

    expect(result.source).toBe('fallback')
    expect(result.models).toEqual(staticOllamaModels())
    expect(result.error).toMatch(/HTTP 500/)
  })

  it('falls back when tags returns an empty model list', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [] }),
    })
    const result = await discoverOllamaModels('http://localhost:11434', fetchImpl as unknown as typeof fetch)

    expect(result.source).toBe('fallback')
    expect(result.error).toMatch(/no models found/i)
  })
})
