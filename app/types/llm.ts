export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama'

export interface ProviderModel {
  id: string
  label: string
  provider: ProviderId
  inputCostPer1M: number
  outputCostPer1M: number
}

export interface SelectedModel {
  slotId: string
  provider: ProviderId
  modelId: string
}

export interface StreamMetrics {
  latencyMs: number
  ttftMs: number | null
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error' | 'cancelled'

export interface ModelResponse {
  slotId: string
  provider: ProviderId
  modelId: string
  content: string
  status: StreamStatus
  metrics: StreamMetrics
  error?: string
  assertionResults?: AssertionResult[]
}

export type AssertionKind = 'jsonValid' | 'jsonSchema' | 'forbiddenSubstring' | 'length'
export type LengthUnit = 'characters' | 'words' | 'tokens'
export type AssertionSummary = 'pass' | 'fail' | 'none'

export interface AssertionRule {
  id: string
  kind: AssertionKind
  substring?: string
  schemaJson?: string
  min?: number
  max?: number
  unit?: LengthUnit
  enabled?: boolean
}

export interface AssertionResult {
  ruleId: string
  kind: AssertionKind
  pass: boolean
  message: string
}

export interface PromptVariables {
  [key: string]: string
}

export interface GenerationParams {
  temperature?: number
  topP?: number
  maxTokens?: number
}

export interface PromptFileData {
  name?: string
  tags?: string[]
  model?: string
  provider?: ProviderId
  generation?: GenerationParams
  variables: PromptVariables
  systemPrompt: string
  userPrompt: string
}

export interface PromptRevision {
  version: number
  systemPrompt: string
  userPrompt: string
  variables: PromptVariables
  generation?: GenerationParams
  savedAt: string
}

export interface PromptSnapshot {
  id: string
  label: string
  source: 'saved' | 'revision' | 'history'
  systemPrompt: string
  userPrompt: string
  variables: PromptVariables
}

export interface SavedPrompt {
  id: string
  name: string
  systemPrompt: string
  userPrompt: string
  tags: string[]
  version: number
  createdAt: string
  updatedAt: string
  variables: PromptVariables
  model?: string
  provider?: ProviderId
  generation?: GenerationParams
  revisions: PromptRevision[]
}

export interface ExecutionHistoryEntry {
  id: string
  systemPrompt: string
  userPrompt: string
  variables: PromptVariables
  models: SelectedModel[]
  responses: ModelResponse[]
  createdAt: string
  assertionSummary?: AssertionSummary
}

export interface StreamRequest {
  provider: ProviderId
  model: string
  systemPrompt: string
  userPrompt: string
  apiKey?: string
  ollamaUrl?: string
  /** Sampling temperature (0–2). Defaults applied in the provider builder. */
  temperature?: number
  /** Max output tokens. Anthropic requires this; others map to provider equivalents. */
  maxTokens?: number
}
