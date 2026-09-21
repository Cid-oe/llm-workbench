// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import type {
  JudgeAggregate,
  JudgeConfig,
  JudgeResult,
  JudgeRubric,
  JudgeRubricScore,
  JudgeScale,
  PromptVariables,
} from '~/types/llm'

export type { JudgeAggregate, JudgeConfig, JudgeResult, JudgeRubric, JudgeRubricScore }

export function createRubricId(): string {
  return `rubric-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createDefaultJudgeConfig(): JudgeConfig {
  return {
    enabled: false,
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    scale: 5,
    passThreshold: 3,
    rubrics: [{
      id: createRubricId(),
      name: 'Accuracy',
      description: 'Is the response factually correct and aligned with the question?',
      enabled: true,
    }],
  }
}

export function enabledRubrics(config: JudgeConfig): JudgeRubric[] {
  return config.rubrics.filter(r => r.enabled !== false && r.name.trim())
}

export function resolveJudgeInput(variables: PromptVariables, userPrompt: string): string {
  const fromVars = variables.input?.trim() || variables.question?.trim()
  return fromVars || userPrompt
}

export function resolveReferenceAnswer(variables: PromptVariables): string | undefined {
  const ref = variables.reference_answer?.trim() || variables.referenceAnswer?.trim()
  return ref || undefined
}

export function buildJudgePrompt(opts: {
  rubrics: JudgeRubric[]
  scale: JudgeScale
  input: string
  candidate: string
  referenceAnswer?: string
}): { systemPrompt: string, userPrompt: string } {
  const scaleMax = opts.scale
  const rubricList = opts.rubrics.map((r, i) =>
    `${i + 1}. id="${r.id}" name="${r.name}" — ${r.description.trim() || 'No description'}`,
  ).join('\n')

  const systemPrompt = [
    'You are an impartial LLM-as-a-Judge. Score the candidate response against each rubric.',
    `Use an integer scale from 1 (worst) to ${scaleMax} (best) for every rubric.`,
    'Respond with ONLY a JSON object (no markdown fences) in this exact shape:',
    '{"scores":[{"rubricId":"<id>","score":<number>,"rationale":"<short>"}],"overall":<number>,"rationale":"<short overall>"}',
    'overall should be the mean of rubric scores (integer or one decimal). Keep each rationale under 40 words.',
  ].join(' ')

  const parts = [
    `## Rubrics\n${rubricList}`,
    `## Input / question\n${opts.input || '(empty)'}`,
  ]
  if (opts.referenceAnswer) {
    parts.push(`## Reference answer\n${opts.referenceAnswer}`)
  }
  parts.push(`## Candidate response\n${opts.candidate || '(empty)'}`)
  parts.push('Return JSON only.')

  return {
    systemPrompt,
    userPrompt: parts.join('\n\n'),
  }
}

function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function clampScore(value: number, scale: JudgeScale): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(scale, Math.max(1, value))
}

/** Parse judge model output into structured scores. Tolerates malformed JSON. */
export function parseJudgeResponse(
  content: string,
  rubrics: JudgeRubric[],
  scale: JudgeScale,
): JudgeResult {
  const emptyScores: JudgeRubricScore[] = rubrics.map(r => ({
    rubricId: r.id,
    name: r.name,
    score: 1,
    rationale: 'Missing score',
  }))

  if (!content.trim()) {
    return {
      overall: 1,
      pass: false,
      rationale: 'Empty judge response',
      scores: emptyScores,
      parseError: 'Empty judge response',
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFences(content))
  }
  catch (e) {
    return {
      overall: 1,
      pass: false,
      rationale: 'Could not parse judge JSON',
      scores: emptyScores,
      parseError: e instanceof Error ? e.message : 'Invalid JSON',
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      overall: 1,
      pass: false,
      rationale: 'Judge JSON must be an object',
      scores: emptyScores,
      parseError: 'Judge JSON must be an object',
    }
  }

  const obj = parsed as Record<string, unknown>
  const rawScores = Array.isArray(obj.scores) ? obj.scores : []
  const byId = new Map<string, { score: number, rationale: string }>()

  for (const item of rawScores) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const rubricId = typeof row.rubricId === 'string' ? row.rubricId
      : typeof row.id === 'string' ? row.id
        : undefined
    if (!rubricId) continue
    const score = clampScore(Number(row.score), scale)
    const rationale = typeof row.rationale === 'string' ? row.rationale.trim() : ''
    byId.set(rubricId, { score, rationale: rationale || '—' })
  }

  // Also allow name-keyed map fallbacks
  for (const rubric of rubrics) {
    if (byId.has(rubric.id)) continue
    const byName = rawScores.find((item) => {
      if (!item || typeof item !== 'object') return false
      const row = item as Record<string, unknown>
      return typeof row.name === 'string' && row.name.toLowerCase() === rubric.name.toLowerCase()
    }) as Record<string, unknown> | undefined
    if (byName) {
      byId.set(rubric.id, {
        score: clampScore(Number(byName.score), scale),
        rationale: typeof byName.rationale === 'string' ? byName.rationale.trim() || '—' : '—',
      })
    }
  }

  const scores: JudgeRubricScore[] = rubrics.map((r) => {
    const found = byId.get(r.id)
    return {
      rubricId: r.id,
      name: r.name,
      score: found?.score ?? 1,
      rationale: found?.rationale ?? 'Missing score',
    }
  })

  const mean = scores.length
    ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
    : 1
  const overallRaw = obj.overall != null ? Number(obj.overall) : mean
  const overall = clampScore(
    Number.isFinite(overallRaw) ? overallRaw : mean,
    scale,
  )
  const rationale = typeof obj.rationale === 'string' && obj.rationale.trim()
    ? obj.rationale.trim()
    : scores.map(s => `${s.name}: ${s.score}`).join('; ')

  return {
    overall,
    pass: false, // filled by applyPassThreshold
    rationale,
    scores,
  }
}

export function applyPassThreshold(
  result: Omit<JudgeResult, 'pass'> & { pass?: boolean },
  threshold: number | undefined,
  scale: JudgeScale,
): JudgeResult {
  const min = threshold == null || !Number.isFinite(threshold)
    ? Math.ceil(scale * 0.6)
    : threshold
  const pass = result.overall >= min && result.scores.every(s => s.score >= min)
  return { ...result, pass, parseError: result.parseError }
}

export function evaluateJudgeText(
  content: string,
  config: Pick<JudgeConfig, 'scale' | 'passThreshold'>,
  rubrics: JudgeRubric[],
): JudgeResult {
  const parsed = parseJudgeResponse(content, rubrics, config.scale)
  return applyPassThreshold(parsed, config.passThreshold, config.scale)
}

export interface JudgeScoreRow {
  modelId: string
  overall?: number
  pass?: boolean
  latencyMs?: number
  costUsd?: number
  status?: string
}

/** Aggregate mean scores, pass rate, latency, and cost per model slot. */
export function aggregateJudgeByModel(rows: JudgeScoreRow[]): JudgeAggregate[] {
  const groups = new Map<string, JudgeScoreRow[]>()
  for (const row of rows) {
    const list = groups.get(row.modelId) ?? []
    list.push(row)
    groups.set(row.modelId, list)
  }

  const aggregates: JudgeAggregate[] = []
  for (const [modelId, list] of groups) {
    const scored = list.filter(r => r.overall != null && Number.isFinite(r.overall))
    const passed = scored.filter(r => r.pass)
    const latencies = list.filter(r => r.latencyMs != null).map(r => r.latencyMs!)
    const costs = list.filter(r => r.costUsd != null).map(r => r.costUsd!)
    aggregates.push({
      modelId,
      count: list.length,
      scoredCount: scored.length,
      meanScore: scored.length
        ? scored.reduce((s, r) => s + (r.overall ?? 0), 0) / scored.length
        : null,
      passRate: scored.length ? passed.length / scored.length : null,
      meanLatencyMs: latencies.length
        ? latencies.reduce((s, n) => s + n, 0) / latencies.length
        : null,
      estimatedCostUsd: costs.length
        ? costs.reduce((s, n) => s + n, 0)
        : null,
    })
  }
  return aggregates.sort((a, b) => a.modelId.localeCompare(b.modelId))
}
