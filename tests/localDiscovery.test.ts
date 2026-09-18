// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest'
import {
  assertAirGappedUrl,
  discoverLocalLlms,
  isCloudProvider,
  isLocalhostUrl,
  parseOpenAiModelList,
} from '../app/lib/localDiscovery'

describe('localDiscovery', () => {
  it('classifies cloud providers and localhost URLs', () => {
    expect(isCloudProvider('openai')).toBe(true)
    expect(isCloudProvider('ollama')).toBe(false)
    expect(isLocalhostUrl('http://localhost:11434')).toBe(true)
    expect(isLocalhostUrl('https://api.openai.com')).toBe(false)
  })

  it('blocks non-localhost URLs when air-gapped', () => {
    expect(() => assertAirGappedUrl('https://api.openai.com/v1', true)).toThrow(/Air-gapped/)
    expect(() => assertAirGappedUrl('http://127.0.0.1:1234/v1', true)).not.toThrow()
  })

  it('parses LM Studio OpenAI model lists', () => {
    const models = parseOpenAiModelList({
      data: [{ id: 'local-model' }, { id: 'local-model' }, { id: 1 }],
    })
    expect(models).toHaveLength(1)
    expect(models[0]?.provider).toBe('lmstudio')
  })

  it('probes Ollama and LM Studio with injectible fetch', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes(':11434')) {
        return new Response(JSON.stringify({ models: [{ name: 'llama3.2' }] }), { status: 200 })
      }
      if (url.includes(':1234')) {
        return new Response(JSON.stringify({ data: [{ id: 'mistral-local' }] }), { status: 200 })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch

    const result = await discoverLocalLlms({ fetchImpl })
    expect(result.primary?.backend).toBe('ollama')
    expect(result.probes.every(p => p.ok)).toBe(true)
    expect(result.probes.find(p => p.backend === 'lmstudio')?.models[0]?.id).toBe('mistral-local')
  })

  it('returns friendly failures when nothing is listening', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch

    const result = await discoverLocalLlms({ fetchImpl })
    expect(result.primary).toBeUndefined()
    expect(result.probes.every(p => !p.ok)).toBe(true)
    expect(result.probes[0]?.error).toMatch(/Could not reach|Ollama/i)
  })
})
