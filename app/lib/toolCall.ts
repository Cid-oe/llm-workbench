import { extractJsonCandidate, looksLikeJson, parseJsonPreview } from '~/lib/jsonPreview'

export interface ToolSignature {
  id: string
  name: string
  description?: string
  /** Free-form JSON Schema / parameters description shown to the user */
  parametersJson?: string
}

export interface DetectedToolCall {
  name: string
  argumentsJson: string
  raw: unknown
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  tool_call_id?: string
}

export function createToolSignatureId(): string {
  return `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringifyArgs(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    }
    catch {
      return value
    }
  }
  try {
    return JSON.stringify(value ?? {}, null, 2)
  }
  catch {
    return '{}'
  }
}

/** Detect OpenAI-style tool_calls or a single {name, arguments} payload in model text. */
export function detectToolCalls(content: string): DetectedToolCall[] {
  if (!looksLikeJson(content) && !content.includes('tool_calls')) {
    // Still try fenced / embedded JSON
    if (!content.includes('{')) return []
  }

  const parsed = parseJsonPreview(content)
  if (!parsed.ok) {
    // Fallback: search for a JSON object substring
    const candidate = extractJsonCandidate(content)
    try {
      const value = JSON.parse(candidate) as unknown
      return detectToolCallsFromValue(value)
    }
    catch {
      return []
    }
  }
  return detectToolCallsFromValue(parsed.value)
}

function detectToolCallsFromValue(value: unknown): DetectedToolCall[] {
  const root = asObject(value)
  if (!root) return []

  if (Array.isArray(root.tool_calls)) {
    const calls: DetectedToolCall[] = []
    for (const entry of root.tool_calls) {
      const call = asObject(entry)
      if (!call) continue
      const fn = asObject(call.function) ?? call
      const name = typeof fn.name === 'string' ? fn.name : typeof call.name === 'string' ? call.name : ''
      if (!name) continue
      calls.push({
        name,
        argumentsJson: stringifyArgs(fn.arguments ?? call.arguments ?? {}),
        raw: entry,
      })
    }
    return calls
  }

  const name = typeof root.name === 'string'
    ? root.name
    : typeof root.tool === 'string'
      ? root.tool
      : typeof asObject(root.function)?.name === 'string'
        ? String(asObject(root.function)!.name)
        : ''

  if (!name) return []
  const args = root.arguments ?? root.parameters ?? asObject(root.function)?.arguments ?? {}
  return [{ name, argumentsJson: stringifyArgs(args), raw: value }]
}

export function matchRegisteredTool(
  call: DetectedToolCall,
  signatures: ToolSignature[],
): ToolSignature | undefined {
  return signatures.find(s => s.name.trim() === call.name.trim())
}

/** Build chat messages for a second-turn run with a mocked tool result. */
export function buildToolFollowUpMessages(input: {
  systemPrompt: string
  userPrompt: string
  assistantContent: string
  toolName: string
  mockResultJson: string
}): ChatMessage[] {
  let mockContent = input.mockResultJson.trim() || '{}'
  try {
    mockContent = JSON.stringify(JSON.parse(mockContent))
  }
  catch {
    // keep raw string — model still receives it as tool content
  }

  return [
    { role: 'system', content: input.systemPrompt },
    { role: 'user', content: input.userPrompt },
    { role: 'assistant', content: input.assistantContent },
    {
      role: 'tool',
      name: input.toolName,
      tool_call_id: `call_${input.toolName}`,
      content: mockContent,
    },
  ]
}

/** Flatten multi-turn messages into a single user prompt for providers that only take system+user. */
export function flattenMessagesForLegacyPrompt(messages: ChatMessage[]): {
  systemPrompt: string
  userPrompt: string
} {
  const system = messages.find(m => m.role === 'system')?.content ?? ''
  const rest = messages.filter(m => m.role !== 'system')
  const userPrompt = rest.map((m) => {
    if (m.role === 'user') return m.content
    if (m.role === 'assistant') return `Assistant:\n${m.content}`
    return `Tool (${m.name ?? 'tool'}):\n${m.content}`
  }).join('\n\n')
  return { systemPrompt: system, userPrompt }
}
