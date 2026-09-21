// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import {
  aggregateJudgeByModel,
  buildJudgePrompt,
  createDefaultJudgeConfig,
  enabledRubrics,
  evaluateJudgeText,
  parseJudgeResponse,
  resolveJudgeInput,
  resolveReferenceAnswer,
} from '../app/lib/judge'

const rubrics = [
  { id: 'r1', name: 'Accuracy', description: 'Factually correct' },
  { id: 'r2', name: 'Tone', description: 'Professional tone' },
]

describe('judge', () => {
  it('builds a judge prompt with rubrics and optional reference', () => {
    const { systemPrompt, userPrompt } = buildJudgePrompt({
      rubrics,
      scale: 5,
      input: 'What is 2+2?',
      candidate: 'Four',
      referenceAnswer: '4',
    })
    expect(systemPrompt).toMatch(/1 \(worst\) to 5/)
    expect(userPrompt).toContain('id="r1"')
    expect(userPrompt).toContain('What is 2+2?')
    expect(userPrompt).toContain('## Reference answer')
    expect(userPrompt).toContain('Four')
  })

  it('parses well-formed judge JSON and applies pass threshold', () => {
    const raw = JSON.stringify({
      scores: [
        { rubricId: 'r1', score: 5, rationale: 'Correct' },
        { rubricId: 'r2', score: 4, rationale: 'Clear' },
      ],
      overall: 4.5,
      rationale: 'Strong answer',
    })
    const result = evaluateJudgeText(raw, { scale: 5, passThreshold: 4 }, rubrics)
    expect(result.overall).toBe(4.5)
    expect(result.pass).toBe(true)
    expect(result.scores).toHaveLength(2)
    expect(result.parseError).toBeUndefined()
  })

  it('handles malformed judge JSON without throwing', () => {
    const bad = parseJudgeResponse('not json {{{', rubrics, 5)
    expect(bad.parseError).toBeTruthy()
    expect(bad.scores).toHaveLength(2)
    expect(bad.overall).toBe(1)

    const empty = parseJudgeResponse('   ', rubrics, 5)
    expect(empty.parseError).toBe('Empty judge response')

    const asArray = parseJudgeResponse('[]', rubrics, 5)
    expect(asArray.parseError).toBe('Judge JSON must be an object')

    const asNull = parseJudgeResponse('null', rubrics, 5)
    expect(asNull.parseError).toBe('Judge JSON must be an object')

    const fenced = evaluateJudgeText(
      '```json\n{"scores":[{"rubricId":"r1","score":3,"rationale":"ok"},{"rubricId":"r2","score":2,"rationale":"meh"}],"overall":2.5}\n```',
      { scale: 5, passThreshold: 4 },
      rubrics,
    )
    expect(fenced.overall).toBe(2.5)
    expect(fenced.pass).toBe(false)
  })

  it('matches scores by id / name and clamps out-of-range values', () => {
    const byIdAlias = evaluateJudgeText(
      JSON.stringify({
        scores: [
          { id: 'r1', score: 99, rationale: 12 },
          { name: 'Tone', score: 0, rationale: '  ' },
          null,
          'skip',
          { score: 3 },
        ],
        overall: 'nope',
      }),
      { scale: 5, passThreshold: undefined },
      rubrics,
    )
    expect(byIdAlias.scores[0]?.score).toBe(5)
    expect(byIdAlias.scores[0]?.rationale).toBe('—')
    expect(byIdAlias.scores[1]?.score).toBe(1)
    expect(byIdAlias.scores[1]?.rationale).toBe('—')
    expect(byIdAlias.pass).toBe(false)

    const byNameOnly = evaluateJudgeText(
      JSON.stringify({
        scores: [{ name: 'accuracy', score: 4, rationale: 'solid' }],
        rationale: 'ok overall',
      }),
      { scale: 5, passThreshold: 3 },
      rubrics,
    )
    expect(byNameOnly.scores[0]?.score).toBe(4)
    expect(byNameOnly.scores[1]?.score).toBe(1)
    expect(byNameOnly.rationale).toBe('ok overall')
  })

  it('resolves input / reference_answer variables', () => {
    expect(resolveJudgeInput({ input: 'from var' }, 'user prompt')).toBe('from var')
    expect(resolveJudgeInput({ question: 'q' }, 'user prompt')).toBe('q')
    expect(resolveJudgeInput({}, 'user prompt')).toBe('user prompt')
    expect(resolveReferenceAnswer({ reference_answer: 'gold' })).toBe('gold')
    expect(resolveReferenceAnswer({ referenceAnswer: 'gold2' })).toBe('gold2')
    expect(resolveReferenceAnswer({})).toBeUndefined()
  })

  it('aggregates mean score, pass rate, latency, and cost per model', () => {
    const aggs = aggregateJudgeByModel([
      { modelId: 'a', overall: 4, pass: true, latencyMs: 100, costUsd: 0.01 },
      { modelId: 'a', overall: 2, pass: false, latencyMs: 200, costUsd: 0.02 },
      { modelId: 'b', overall: 5, pass: true, latencyMs: 50, costUsd: 0.005 },
      { modelId: 'c' },
    ])
    const a = aggs.find(x => x.modelId === 'a')!
    expect(a.meanScore).toBe(3)
    expect(a.passRate).toBe(0.5)
    expect(a.meanLatencyMs).toBe(150)
    expect(a.estimatedCostUsd).toBeCloseTo(0.03)
    const c = aggs.find(x => x.modelId === 'c')!
    expect(c.meanScore).toBeNull()
    expect(c.passRate).toBeNull()
  })

  it('defaults include one enabled rubric and skips disabled ones', () => {
    const config = createDefaultJudgeConfig()
    expect(config.enabled).toBe(false)
    expect(enabledRubrics(config)).toHaveLength(1)
    expect(enabledRubrics({
      ...config,
      rubrics: [
        { id: '1', name: 'A', description: '', enabled: false },
        { id: '2', name: '   ', description: 'x', enabled: true },
        { id: '3', name: 'B', description: 'y', enabled: true },
      ],
    })).toHaveLength(1)
  })
})
