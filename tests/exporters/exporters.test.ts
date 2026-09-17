import { describe, expect, it } from 'vitest'
import { envVarName, exportCode } from '~/lib/exporters'
import type { ExportLanguage } from '~/lib/exporters'

describe('lib/exporters', () => {
  const baseOpts = {
    provider: 'openai' as const,
    model: 'gpt-4o-mini',
    systemPrompt: 'You are helpful.',
    userPrompt: 'Say hi',
  }

  const languages: ExportLanguage[] = ['javascript', 'python', 'curl', 'php']

  it.each(languages)('exports a non-empty %s snippet for OpenAI', (language) => {
    const code = exportCode(language, baseOpts)
    expect(code.length).toBeGreaterThan(20)
    expect(code).toContain('gpt-4o-mini')
  })

  it('javascript uses process.env placeholder', () => {
    const code = exportCode('javascript', baseOpts)
    expect(code).toContain('process.env.OPENAI_API_KEY')
    expect(code).toContain('fetch(')
  })

  it('python uses os.environ placeholder', () => {
    const code = exportCode('python', baseOpts)
    expect(code).toContain("os.environ['OPENAI_API_KEY']")
    expect(code).toContain('from openai import OpenAI')
  })

  it('curl uses $OPENAI_API_KEY', () => {
    const code = exportCode('curl', baseOpts)
    expect(code).toContain('curl https://api.openai.com')
    expect(code).toContain('$OPENAI_API_KEY')
  })

  it('php uses getenv', () => {
    const code = exportCode('php', baseOpts)
    expect(code).toContain('curl_init')
    expect(code).toContain("getenv('OPENAI_API_KEY')")
  })

  it('maps envVarName for cloud providers', () => {
    expect(envVarName('openai')).toBe('OPENAI_API_KEY')
    expect(envVarName('anthropic')).toBe('ANTHROPIC_API_KEY')
    expect(envVarName('gemini')).toBe('GEMINI_API_KEY')
    expect(envVarName('groq')).toBe('GROQ_API_KEY')
  })
})
