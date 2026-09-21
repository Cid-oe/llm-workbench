// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type { PromptVariables } from '~/types/llm'
import type { RagHit } from '~/lib/rag/types'

export const RAG_CONTEXT_VAR = 'rag_context'

export function formatRetrievedContext(hits: RagHit[]): string {
  if (!hits.length) return ''
  return hits.map((hit, i) => {
    const score = hit.score.toFixed(3)
    return `[${i + 1}] (${hit.chunk.documentName} · score ${score})\n${hit.chunk.text}`
  }).join('\n\n')
}

/**
 * Inject retrieved context via {{rag_context}} when present, otherwise append a
 * context section to the system prompt so Compare never silently drops RAG.
 */
export function injectRagContext(opts: {
  systemPrompt: string
  userPrompt: string
  variables: PromptVariables
  hits: RagHit[]
}): {
  systemPrompt: string
  userPrompt: string
  variables: PromptVariables
  contextBlock: string
  injectedVia: 'variable' | 'system' | 'none'
} {
  const contextBlock = formatRetrievedContext(opts.hits)
  const variables: PromptVariables = {
    ...opts.variables,
    [RAG_CONTEXT_VAR]: contextBlock,
  }

  if (!contextBlock) {
    return {
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.userPrompt,
      variables,
      contextBlock: '',
      injectedVia: 'none',
    }
  }

  const usesVar = opts.systemPrompt.includes(`{{${RAG_CONTEXT_VAR}}}`)
    || opts.userPrompt.includes(`{{${RAG_CONTEXT_VAR}}}`)

  if (usesVar) {
    return {
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.userPrompt,
      variables,
      contextBlock,
      injectedVia: 'variable',
    }
  }

  const systemPrompt = [
    opts.systemPrompt.trimEnd(),
    '',
    '## Retrieved context',
    'Use the following passages when answering. Cite sources by bracket number when helpful.',
    contextBlock,
  ].join('\n')

  return {
    systemPrompt,
    userPrompt: opts.userPrompt,
    variables,
    contextBlock,
    injectedVia: 'system',
  }
}
