// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { envVarName, useCodeExporter } from '../app/composables/useCodeExporter'
import type { ExportLanguage } from '../app/composables/useCodeExporter'

describe('useCodeExporter', () => {
  const { exportCode } = useCodeExporter()

  const secret = 'sk-super-secret-do-not-leak'
  const baseOpts = {
    provider: 'openai' as const,
    model: 'gpt-4o-mini',
    systemPrompt: 'You are helpful.',
    userPrompt: 'Say hi',
    apiKey: secret,
  }

  const languages: ExportLanguage[] = [
    'javascript',
    'python',
    'curl',
    'php',
    'sdk-typescript',
    'vercel-ai',
    'langchain-ts',
    'langchain-py',
  ]

  it.each(languages)('never interpolates the apiKey into %s snippets', (language) => {
    const code = exportCode(language, baseOpts)
    expect(code).not.toContain(secret)
    expect(code).not.toContain('YOUR_API_KEY')
  })

  it('exports JavaScript fetch snippet with env placeholder', () => {
    const code = exportCode('javascript', baseOpts)
    expect(code).toContain('fetch(')
    expect(code).toContain('gpt-4o-mini')
    expect(code).toContain('process.env.OPENAI_API_KEY')
    expect(code).toContain('temperature: 0.7')
    expect(code).toContain('max_tokens: 4096')
    expect(code).not.toContain('Bearer sk-')
  })

  it('exports Python OpenAI snippet', () => {
    const code = exportCode('python', { ...baseOpts, temperature: 0.3, maxTokens: 256 })
    expect(code).toContain('from openai import OpenAI')
    expect(code).toContain('gpt-4o-mini')
    expect(code).toContain("os.environ['OPENAI_API_KEY']")
    expect(code).toContain('temperature=0.3')
    expect(code).toContain('max_tokens=256')
  })

  it('exports cURL command', () => {
    const code = exportCode('curl', baseOpts)
    expect(code).toContain('curl https://api.openai.com')
    expect(code).toContain('Authorization')
    expect(code).toContain('$OPENAI_API_KEY')
  })

  it('exports PHP curl snippet', () => {
    const code = exportCode('php', baseOpts)
    expect(code).toContain('curl_init')
    expect(code).toContain('gpt-4o-mini')
    expect(code).toContain("getenv('OPENAI_API_KEY')")
  })

  it('exports Python Gemini snippet without leaking the key', () => {
    const apiKey = 'AIza-test-secret'
    const code = exportCode('python', {
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      systemPrompt: 'You are helpful.',
      userPrompt: 'Say hi',
      apiKey,
    })
    expect(code).toContain('from google import genai')
    expect(code).toContain('gemini-3.6-flash')
    expect(code).toContain("os.environ['GEMINI_API_KEY']")
    expect(code).not.toContain(apiKey)
    expect(code).not.toMatch(/^# Provider:/)
  })

  it('exports Python Groq snippet without leaking the key', () => {
    const apiKey = 'gsk_test_secret'
    const code = exportCode('python', {
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      apiKey,
    })
    expect(code).toContain('base_url="https://api.groq.com/openai/v1"')
    expect(code).toContain("os.environ['GROQ_API_KEY']")
    expect(code).not.toContain(apiKey)
  })

  it('exports Python Anthropic snippet without leaking the key', () => {
    const apiKey = 'sk-ant-secret'
    const code = exportCode('python', {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      apiKey,
      temperature: 0.4,
      maxTokens: 800,
    })
    expect(code).toContain("os.environ['ANTHROPIC_API_KEY']")
    expect(code).toContain('max_tokens=800')
    expect(code).toContain('temperature=0.4')
    expect(code).not.toContain(apiKey)
  })

  it('exports Python Ollama snippet', () => {
    const code = exportCode('python', {
      provider: 'ollama',
      model: 'llama3.2',
      systemPrompt: 'Sys',
      userPrompt: 'Hi',
      ollamaUrl: 'http://localhost:11434',
    })
    expect(code).toContain('import requests')
    expect(code).toContain('localhost:11434')
  })

  it('exports Ollama JavaScript without API key', () => {
    const code = exportCode('javascript', {
      provider: 'ollama',
      model: 'llama3.2',
      systemPrompt: 'Sys',
      userPrompt: 'User',
      ollamaUrl: 'http://localhost:11434',
    })
    expect(code).toContain('localhost:11434')
    expect(code).not.toContain('Bearer')
  })

  it('maps providers to environment variable names', () => {
    expect(envVarName('openai')).toBe('OPENAI_API_KEY')
    expect(envVarName('anthropic')).toBe('ANTHROPIC_API_KEY')
    expect(envVarName('gemini')).toBe('GEMINI_API_KEY')
    expect(envVarName('groq')).toBe('GROQ_API_KEY')
  })

  it('exports TypeScript SDK snippet for OpenAI', () => {
    const code = exportCode('sdk-typescript', baseOpts)
    expect(code).toContain("import OpenAI from 'openai'")
    expect(code).toContain('process.env.OPENAI_API_KEY')
    expect(code).toContain('stream: true')
    expect(code).not.toContain(secret)
  })

  it('exports Vercel AI SDK snippet', () => {
    const code = exportCode('vercel-ai', baseOpts)
    expect(code).toContain("from 'ai'")
    expect(code).toContain('@ai-sdk/openai')
    expect(code).toContain('streamText')
    expect(code).toContain('process.env.OPENAI_API_KEY')
    expect(code).not.toContain(secret)
  })

  it('exports LangChain TypeScript and Python snippets', () => {
    const ts = exportCode('langchain-ts', baseOpts)
    expect(ts).toContain('@langchain/openai')
    expect(ts).toContain('ChatOpenAI')
    expect(ts).not.toContain(secret)

    const py = exportCode('langchain-py', baseOpts)
    expect(py).toContain('langchain_openai')
    expect(py).toContain('ChatOpenAI')
    expect(py).toContain('OPENAI_API_KEY')
    expect(py).not.toContain(secret)
  })
})
