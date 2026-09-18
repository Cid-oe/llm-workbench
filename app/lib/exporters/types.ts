// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { ProviderId } from '~/types/llm'

export type ExportLanguage = 'javascript' | 'python' | 'curl' | 'php'

export interface ExportOptions {
  provider: ProviderId
  model: string
  systemPrompt: string
  userPrompt: string
  /** Ignored in generated snippets — keys must come from the environment. */
  apiKey?: string
  ollamaUrl?: string
  lmStudioUrl?: string
  temperature?: number
  maxTokens?: number
}
