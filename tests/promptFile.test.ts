import { describe, expect, it } from 'vitest'
import {
  isSecretFrontmatterKey,
  parsePromptFile,
  promptFileName,
  serializePromptFile,
} from '../app/lib/promptFile'

const sample = {
  name: 'Expert helper',
  model: 'gpt-4o',
  provider: 'openai' as const,
  tags: ['demo'],
  generation: { temperature: 0.7, topP: 0.9, maxTokens: 512 },
  variables: { user_role: 'editor', topic: 'git' },
  systemPrompt: 'Eres un asistente experto para {{user_role}}.',
  userPrompt: 'Explica {{topic}} en tres bullets.',
}

describe('promptFile', () => {
  it('round-trips Markdown frontmatter and prompt sections', () => {
    const markdown = serializePromptFile(sample)
    const parsed = parsePromptFile(markdown)

    expect(markdown.startsWith('---\n')).toBe(true)
    expect(markdown).toContain('## System')
    expect(markdown).toContain('## User')
    expect(parsed).toEqual({
      name: 'Expert helper',
      tags: ['demo'],
      model: 'gpt-4o',
      provider: 'openai',
      generation: { temperature: 0.7, topP: 0.9, maxTokens: 512 },
      variables: { user_role: 'editor', topic: 'git' },
      systemPrompt: 'Eres un asistente experto para {{user_role}}.',
      userPrompt: 'Explica {{topic}} en tres bullets.',
    })
  })

  it('parses variable name lists from the issue example', () => {
    const markdown = `---
model: gpt-4o
temperature: 0.7
variables:
  - user_role
---
## System
Eres un asistente experto para {{user_role}}...
## User
Hola
`
    const parsed = parsePromptFile(markdown)
    expect(parsed.model).toBe('gpt-4o')
    expect(parsed.generation).toEqual({ temperature: 0.7 })
    expect(parsed.variables).toEqual({ user_role: '' })
    expect(parsed.systemPrompt).toContain('asistente experto')
    expect(parsed.userPrompt).toBe('Hola')
  })

  it('never keeps secrets from imported frontmatter and never writes them on export', () => {
    const markdown = `---
model: gpt-4o
apiKey: sk-live-secret
openai_key: sk-other
authorization: Bearer sk-live-secret
variables:
  topic: quantum
  api_key: sk-in-variable
---
## User
Do the thing
`
    const parsed = parsePromptFile(markdown)
    expect(parsed.model).toBe('gpt-4o')
    expect(JSON.stringify(parsed)).not.toContain('sk-live-secret')
    expect(JSON.stringify(parsed)).not.toContain('sk-other')
    expect(JSON.stringify(parsed)).not.toContain('sk-in-variable')
    expect(parsed.variables).toEqual({ topic: 'quantum' })

    const exported = serializePromptFile({
      ...parsed,
      variables: { topic: 'quantum', apiKey: 'sk-should-not-leak' },
    })
    expect(exported).not.toContain('sk-')
    expect(exported).not.toContain('apiKey')
    expect(isSecretFrontmatterKey('groq_key')).toBe(true)
    expect(isSecretFrontmatterKey('max_tokens')).toBe(false)
  })

  it('treats a file without frontmatter as the user prompt', () => {
    const parsed = parsePromptFile('Just a user prompt with {{name}}')
    expect(parsed.userPrompt).toBe('Just a user prompt with {{name}}')
    expect(parsed.systemPrompt).toBe('')
  })

  it('builds a .prompt filename slug', () => {
    expect(promptFileName('My Prompt Pack')).toBe('my-prompt-pack.prompt')
    expect(promptFileName('')).toBe('prompt.prompt')
  })
})
