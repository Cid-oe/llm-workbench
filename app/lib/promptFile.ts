import type { GenerationParams, PromptFileData, PromptVariables, ProviderId } from '~/types/llm'

const PROVIDERS: ProviderId[] = ['openai', 'anthropic', 'gemini', 'groq', 'ollama']

const SECRET_KEY_RE = /^(?:api[_-]?key|(?:openai|anthropic|gemini|groq)[_-]?key|.*(?:secret|password|authorization|credential).*|(?:access|auth|bearer|refresh|id)[_-]?token)$/i

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/

type YamlScalar = string | number | boolean | null
type YamlValue = YamlScalar | YamlValue[] | { [key: string]: YamlValue }

export class PromptFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PromptFileError'
  }
}

export function isSecretFrontmatterKey(key: string): boolean {
  return SECRET_KEY_RE.test(key.trim())
}

export function promptFileName(name?: string): string {
  const slug = (name ?? 'prompt')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'prompt'}.prompt`
}

export function serializePromptFile(data: PromptFileData): string {
  const lines: string[] = ['---']

  if (data.name) lines.push(dumpPair('name', data.name))
  if (data.model) lines.push(dumpPair('model', data.model))
  if (data.provider) lines.push(dumpPair('provider', data.provider))
  if (data.generation?.temperature !== undefined) {
    lines.push(dumpPair('temperature', data.generation.temperature))
  }
  if (data.generation?.topP !== undefined) {
    lines.push(dumpPair('top_p', data.generation.topP))
  }
  if (data.generation?.maxTokens !== undefined) {
    lines.push(dumpPair('max_tokens', data.generation.maxTokens))
  }
  if (data.tags?.length) {
    lines.push('tags:')
    for (const tag of data.tags) lines.push(`  - ${dumpScalar(tag)}`)
  }

  const varEntries = Object.entries(data.variables ?? {}).filter(([key]) => !isSecretFrontmatterKey(key))
  if (varEntries.length) {
    const hasValues = varEntries.some(([, value]) => value !== '')
    lines.push('variables:')
    if (hasValues) {
      for (const [key, value] of varEntries) {
        lines.push(`  ${dumpPair(key, value)}`)
      }
    }
    else {
      for (const [key] of varEntries) lines.push(`  - ${dumpScalar(key)}`)
    }
  }

  lines.push('---', '', '## System', '', data.systemPrompt ?? '', '', '## User', '', data.userPrompt ?? '', '')
  return lines.join('\n')
}

export function parsePromptFile(markdown: string): PromptFileData {
  const source = markdown.replace(/^\uFEFF/, '')
  const match = source.match(FRONTMATTER_RE)
  const rawMatter = match?.[1] ?? ''
  const body = match?.[2] ?? source

  const matter = stripSecretKeys(parseYamlMap(rawMatter))
  const { systemPrompt, userPrompt } = parsePromptBody(body)

  return {
    name: asOptionalString(matter.name),
    tags: asStringList(matter.tags),
    model: asOptionalString(matter.model),
    provider: asProvider(matter.provider),
    generation: parseGeneration(matter),
    variables: parseVariables(matter.variables),
    systemPrompt,
    userPrompt,
  }
}

function parseGeneration(matter: Record<string, YamlValue>): GenerationParams | undefined {
  const generation: GenerationParams = {}
  const temperature = asOptionalNumber(matter.temperature)
  const topP = asOptionalNumber(matter.top_p ?? matter.topP)
  const maxTokens = asOptionalNumber(matter.max_tokens ?? matter.maxTokens)
  if (temperature !== undefined) generation.temperature = temperature
  if (topP !== undefined) generation.topP = topP
  if (maxTokens !== undefined) generation.maxTokens = maxTokens
  return Object.keys(generation).length ? generation : undefined
}

function parseVariables(value: YamlValue | undefined): PromptVariables {
  if (value == null) return {}
  if (Array.isArray(value)) {
    const vars: PromptVariables = {}
    for (const item of value) {
      if (typeof item === 'string' && item) vars[item] = ''
    }
    return vars
  }
  if (typeof value === 'object') {
    const vars: PromptVariables = {}
    for (const [key, raw] of Object.entries(value)) {
      if (isSecretFrontmatterKey(key)) continue
      vars[key] = raw == null ? '' : String(raw)
    }
    return vars
  }
  return {}
}

function parsePromptBody(body: string): { systemPrompt: string; userPrompt: string } {
  const text = body.replace(/^\s+/, '')
  const headingRe = /^##[ \t]+(System|User)[ \t]*$/gim
  const hits: { kind: 'system' | 'user'; start: number; contentStart: number }[] = []
  let match = headingRe.exec(text)
  while (match) {
    hits.push({
      kind: match[1]!.toLowerCase() as 'system' | 'user',
      start: match.index,
      contentStart: match.index + match[0].length,
    })
    match = headingRe.exec(text)
  }

  if (!hits.length) {
    return { systemPrompt: '', userPrompt: text.trim() }
  }

  let systemPrompt = ''
  let userPrompt = ''
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!
    const end = hits[i + 1]?.start ?? text.length
    const content = text.slice(hit.contentStart, end).replace(/^\r?\n*/, '').replace(/\s+$/, '')
    if (hit.kind === 'system') systemPrompt = content
    else userPrompt = content
  }
  return { systemPrompt, userPrompt }
}

function stripSecretKeys(input: Record<string, YamlValue>): Record<string, YamlValue> {
  const out: Record<string, YamlValue> = {}
  for (const [key, value] of Object.entries(input)) {
    if (isSecretFrontmatterKey(key)) continue
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = stripSecretKeys(value as Record<string, YamlValue>)
    }
    else {
      out[key] = value
    }
  }
  return out
}

function parseYamlMap(text: string): Record<string, YamlValue> {
  const lines = text.split(/\r?\n/)
  let index = 0

  const peekIndent = (): number | null => {
    while (index < lines.length) {
      const line = lines[index]!
      if (line.trim() === '' || line.trim().startsWith('#')) {
        index++
        continue
      }
      return line.match(/^ */)![0].length
    }
    return null
  }

  const parseValue = (indent: number): YamlValue => {
    const current = peekIndent()
    if (current == null || current < indent) return {}
    const line = lines[index]!
    if (line.slice(current).startsWith('- ')) return parseList(indent)
    return parseMap(indent)
  }

  const parseMap = (indent: number): Record<string, YamlValue> => {
    const obj: Record<string, YamlValue> = {}
    while (true) {
      const current = peekIndent()
      if (current == null || current < indent) break
      if (current > indent) {
        throw new PromptFileError('Invalid YAML indentation in prompt frontmatter')
      }
      const line = lines[index]!
      const trimmed = line.slice(indent)
      if (trimmed.startsWith('- ')) {
        throw new PromptFileError('Unexpected list item in YAML mapping')
      }
      const colon = trimmed.indexOf(':')
      if (colon === -1) {
        throw new PromptFileError(`Invalid YAML line: ${trimmed}`)
      }
      const key = trimmed.slice(0, colon).trim()
      const rest = trimmed.slice(colon + 1).trim()
      index++
      if (!key) throw new PromptFileError('YAML mapping is missing a key')
      if (rest === '' || rest === '|' || rest === '>') {
        obj[key] = parseValue(indent + 2)
      }
      else {
        obj[key] = parseScalar(rest)
      }
    }
    return obj
  }

  const parseList = (indent: number): YamlValue[] => {
    const list: YamlValue[] = []
    while (true) {
      const current = peekIndent()
      if (current == null || current < indent) break
      if (current > indent) {
        throw new PromptFileError('Invalid YAML list indentation in prompt frontmatter')
      }
      const line = lines[index]!
      const trimmed = line.slice(indent)
      if (!trimmed.startsWith('- ')) {
        throw new PromptFileError('Expected a YAML list item')
      }
      const rest = trimmed.slice(2).trim()
      index++
      if (rest === '') list.push(parseValue(indent + 2))
      else if (rest.includes(':') && !rest.startsWith('"') && !rest.startsWith("'")) {
        const colon = rest.indexOf(':')
        const nestedKey = rest.slice(0, colon).trim()
        const nestedVal = rest.slice(colon + 1).trim()
        const child = nestedVal === '' ? parseValue(indent + 2) : parseScalar(nestedVal)
        const extra = parseMap(indent + 2)
        list.push({ [nestedKey]: child, ...extra })
      }
      else {
        list.push(parseScalar(rest))
      }
    }
    return list
  }

  return parseMap(0)
}

function parseScalar(raw: string): YamlScalar {
  const text = raw.replace(/\s+#.*$/, '').trim()
  if (text === '~' || text === 'null' || text === 'Null') return null
  if (text === 'true' || text === 'True') return true
  if (text === 'false' || text === 'False') return false
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1)
  }
  if (/^-?\d+$/.test(text)) return Number.parseInt(text, 10)
  if (/^-?\d+\.\d+$/.test(text)) return Number.parseFloat(text)
  return text
}

function dumpPair(key: string, value: string | number): string {
  return `${key}: ${dumpScalar(value)}`
}

function dumpScalar(value: string | number): string {
  if (typeof value === 'number') return String(value)
  if (value === '' || /[:#{}[\],&*?]|^\s|\s$|^(?:true|false|null|~)$/i.test(value) || /[\r\n]/.test(value)) {
    return JSON.stringify(value)
  }
  return value
}

function asOptionalString(value: YamlValue | undefined): string | undefined {
  if (typeof value === 'string' && value) return value
  if (typeof value === 'number') return String(value)
  return undefined
}

function asOptionalNumber(value: YamlValue | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value)
  return undefined
}

function asStringList(value: YamlValue | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function asProvider(value: YamlValue | undefined): ProviderId | undefined {
  if (typeof value !== 'string') return undefined
  return PROVIDERS.includes(value as ProviderId) ? value as ProviderId : undefined
}
