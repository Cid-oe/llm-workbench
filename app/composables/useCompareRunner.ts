// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import {
  applyColumnMapping,
  truncatePreview,
  type BulkCaseResult,
  type BulkModelResult,
  type ColumnMapping,
} from '~/lib/dataset'
import { markInFlightAsCancelled, shouldPersistRunHistory } from '~/lib/runHistory'
import { evaluateAssertions, summarizeResponses } from '~/lib/assertions'
import {
  aggregateJudgeByModel,
  buildJudgePrompt,
  enabledRubrics,
  evaluateJudgeText,
  resolveJudgeInput,
  resolveReferenceAnswer,
} from '~/lib/judge'
import { injectToolsIntoSystemPrompt } from '~/lib/mcp/signatures'
import { buildToolFollowUpMessages, flattenMessagesForLegacyPrompt } from '~/lib/toolCall'
import { PROVIDER_MODELS } from '~/lib/providerModels'
import { buildMetrics, createInitialMetrics } from '~/lib/streamMetrics'
import { interpolateVariables } from '~/lib/variables'
import type { JudgeAggregate, JudgeResult, ModelResponse, PromptVariables } from '~/types/llm'

export function useCompareRunner() {
  const promptStore = usePromptStore()
  const providerStore = useProviderStore()
  const mcpStore = useMcpStore()
  const { streamCompletion } = useLLMStream()
  const { estimateTokens, calculateCost } = useCostCalculator()

  const abortControllers = ref<AbortController[]>([])
  const bulkResults = ref<BulkCaseResult[]>([])
  const bulkProgress = ref('')
  const bulkCancelled = ref(false)
  const bulkJudgeAggregates = ref<JudgeAggregate[]>([])

  const canRun = computed(() =>
    providerStore.selectedModels.every(s => providerStore.isProviderConfigured(s.provider)),
  )

  function clearBulkResults() {
    bulkResults.value = []
    bulkProgress.value = ''
    bulkJudgeAggregates.value = []
  }

  function createEmptyResponse(slotId: string, provider: ModelResponse['provider'], modelId: string): ModelResponse {
    const model = PROVIDER_MODELS.find(m => m.id === modelId)
    const inputText = promptStore.interpolatedSystemPrompt + promptStore.interpolatedUserPrompt
    const inputTokens = estimateTokens(inputText)

    return {
      slotId,
      provider,
      modelId,
      content: '',
      status: 'idle',
      metrics: createInitialMetrics(inputTokens, calculateCost(model, inputTokens, 0)),
    }
  }

  async function runSlotStream(
    slot: { slotId: string, provider: ModelResponse['provider'], modelId: string },
    prompts: { systemPrompt: string, userPrompt: string },
    options?: {
      onUpdate?: (partial: Partial<ModelResponse> & { content?: string }) => void
      updateStore?: boolean
      includeMcpTools?: boolean
    },
  ): Promise<{ content: string, status: ModelResponse['status'], latencyMs: number, error?: string, costUsd: number }> {
    const controller = new AbortController()
    abortControllers.value.push(controller)
    const startTime = performance.now()
    let content = ''
    let status: ModelResponse['status'] = 'streaming'
    let errorMessage: string | undefined
    const mcpTools = options?.includeMcpTools === false ? [] : mcpStore.enabledTools
    const promptsWithTools = {
      systemPrompt: injectToolsIntoSystemPrompt(prompts.systemPrompt, mcpTools),
      userPrompt: prompts.userPrompt,
    }
    const inputTokens = estimateTokens(promptsWithTools.systemPrompt + promptsWithTools.userPrompt)
    const baseMetrics = createInitialMetrics(
      inputTokens,
      calculateCost(PROVIDER_MODELS.find(m => m.id === slot.modelId), inputTokens, 0),
    )

    if (options?.updateStore !== false) {
      promptStore.updateResponse(slot.slotId, { status: 'streaming' })
    }

    await streamCompletion(
      {
        provider: slot.provider,
        model: slot.modelId,
        systemPrompt: promptsWithTools.systemPrompt,
        userPrompt: promptsWithTools.userPrompt,
        apiKey: providerStore.getApiKey(slot.provider),
        ollamaUrl: providerStore.ollamaUrl,
        lmStudioUrl: providerStore.lmStudioUrl,
        temperature: promptStore.generation.temperature,
        maxTokens: promptStore.generation.maxTokens,
        mcpTools: mcpTools.length ? mcpTools : undefined,
      },
      {
        onChunk: (text) => {
          content += text
          const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
          const outputTokens = estimateTokens(content)
          const metrics = buildMetrics(baseMetrics, {
            outputTokens,
            costUsd: calculateCost(model, inputTokens, outputTokens),
            latencyMs: performance.now() - startTime,
          })
          options?.onUpdate?.({ content, metrics })
          if (options?.updateStore !== false) {
            promptStore.updateResponse(slot.slotId, { content, metrics })
          }
        },
        onFirstToken: (ttftMs) => {
          baseMetrics.ttftMs = ttftMs
          if (options?.updateStore !== false) {
            const current = promptStore.responses.find(r => r.slotId === slot.slotId)
            if (!current) return
            promptStore.updateResponse(slot.slotId, {
              metrics: buildMetrics(current.metrics, { ttftMs }),
            })
          }
        },
        onDone: () => {
          status = 'done'
          const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
          const outputTokens = estimateTokens(content)
          const metrics = buildMetrics(baseMetrics, {
            outputTokens,
            costUsd: calculateCost(model, inputTokens, outputTokens),
            latencyMs: performance.now() - startTime,
          })
          if (options?.updateStore !== false) {
            promptStore.updateResponse(slot.slotId, { status: 'done', metrics })
          }
        },
        onError: (error) => {
          status = 'error'
          errorMessage = error.message
          const metrics = buildMetrics(baseMetrics, {
            latencyMs: performance.now() - startTime,
          })
          if (options?.updateStore !== false) {
            promptStore.updateResponse(slot.slotId, {
              status: 'error',
              error: error.message,
              metrics,
            })
          }
        },
      },
      controller.signal,
    )

    if (controller.signal.aborted && (status === 'streaming' || status === 'idle')) {
      status = 'cancelled'
      const metrics = buildMetrics(baseMetrics, {
        outputTokens: estimateTokens(content),
        latencyMs: performance.now() - startTime,
      })
      if (options?.updateStore !== false) {
        promptStore.updateResponse(slot.slotId, {
          status: 'cancelled',
          content,
          metrics,
        })
      }
    }

    const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
    const outputTokens = estimateTokens(content)
    const costUsd = calculateCost(model, inputTokens, outputTokens)

    return {
      content,
      status,
      latencyMs: performance.now() - startTime,
      error: errorMessage,
      costUsd,
    }
  }

  async function scoreWithJudge(opts: {
    candidate: string
    variables: PromptVariables
    userPrompt: string
  }): Promise<JudgeResult | undefined> {
    const config = promptStore.judge
    if (!config.enabled) return undefined
    const rubrics = enabledRubrics(config)
    if (!rubrics.length) {
      return {
        overall: 1,
        pass: false,
        rationale: 'No rubrics configured',
        scores: [],
        parseError: 'No rubrics configured',
        judgeModelId: config.modelId,
      }
    }
    if (!providerStore.isProviderConfigured(config.provider)) {
      return {
        overall: 1,
        pass: false,
        rationale: 'Evaluator provider is not configured',
        scores: rubrics.map(r => ({
          rubricId: r.id,
          name: r.name,
          score: 1,
          rationale: 'Evaluator not configured',
        })),
        parseError: 'Evaluator provider is not configured',
        judgeModelId: config.modelId,
      }
    }

    const prompts = buildJudgePrompt({
      rubrics,
      scale: config.scale,
      input: resolveJudgeInput(opts.variables, opts.userPrompt),
      candidate: opts.candidate,
      referenceAnswer: resolveReferenceAnswer(opts.variables),
    })

    const result = await runSlotStream(
      {
        slotId: `judge-${Date.now()}`,
        provider: config.provider,
        modelId: config.modelId,
      },
      prompts,
      { updateStore: false, includeMcpTools: false },
    )

    if (result.status !== 'done') {
      return {
        overall: 1,
        pass: false,
        rationale: result.error || 'Judge call failed',
        scores: rubrics.map(r => ({
          rubricId: r.id,
          name: r.name,
          score: 1,
          rationale: 'Judge call failed',
        })),
        parseError: result.error || 'Judge call failed',
        latencyMs: result.latencyMs,
        costUsd: result.costUsd,
        judgeModelId: config.modelId,
      }
    }

    const judged = evaluateJudgeText(result.content, config, rubrics)
    return {
      ...judged,
      latencyMs: result.latencyMs,
      costUsd: result.costUsd,
      judgeModelId: config.modelId,
    }
  }

  function refreshBulkJudgeAggregates() {
    const rows = bulkResults.value.flatMap(caseResult =>
      caseResult.models.map(m => ({
        modelId: m.modelId,
        overall: m.judgeOverall,
        pass: m.judgePass,
        latencyMs: m.latencyMs,
        costUsd: m.costUsd,
        status: m.status,
      })),
    )
    bulkJudgeAggregates.value = aggregateJudgeByModel(rows)
  }

  async function runAll() {
    stopAll()
    bulkCancelled.value = false
    promptStore.isRunning = true
    abortControllers.value = []

    const initialResponses = providerStore.selectedModels.map(slot =>
      createEmptyResponse(slot.slotId, slot.provider, slot.modelId),
    )
    promptStore.setResponses(initialResponses)

    const prompts = {
      systemPrompt: promptStore.interpolatedSystemPrompt,
      userPrompt: promptStore.interpolatedUserPrompt,
    }

    await Promise.allSettled(
      providerStore.selectedModels.map(slot => runSlotStream(slot, prompts)),
    )

    promptStore.setResponses(markInFlightAsCancelled(promptStore.responses))

    if (promptStore.assertions.length) {
      for (const response of promptStore.responses) {
        if (response.status !== 'done') continue
        promptStore.updateResponse(response.slotId, {
          assertionResults: evaluateAssertions(promptStore.assertions, response.content),
        })
      }
    }

    if (promptStore.judge.enabled && !bulkCancelled.value) {
      bulkProgress.value = 'Scoring with LLM judge…'
      for (const response of promptStore.responses) {
        if (response.status !== 'done' || bulkCancelled.value) continue
        const judgeResult = await scoreWithJudge({
          candidate: response.content,
          variables: promptStore.variables,
          userPrompt: prompts.userPrompt,
        })
        if (judgeResult) {
          promptStore.updateResponse(response.slotId, { judgeResult })
        }
      }
      bulkProgress.value = ''
    }

    promptStore.isRunning = false

    if (shouldPersistRunHistory(promptStore.responses)) {
      promptStore.addToHistory(
        promptStore.responses,
        providerStore.selectedModels.map(s => ({ ...s })),
        summarizeResponses(promptStore.responses),
      )
    }
  }

  async function continueWithTool(payload: {
    slotId: string
    toolName: string
    mockResultJson: string
    assistantContent: string
    mcpInspection?: ModelResponse['mcpInspection']
  }) {
    const slot = providerStore.selectedModels.find(s => s.slotId === payload.slotId)
    if (!slot || promptStore.isRunning) return

    const messages = buildToolFollowUpMessages({
      systemPrompt: promptStore.interpolatedSystemPrompt,
      userPrompt: promptStore.interpolatedUserPrompt,
      assistantContent: payload.assistantContent,
      toolName: payload.toolName,
      mockResultJson: payload.mockResultJson,
    })
    const prompts = flattenMessagesForLegacyPrompt(messages)

    promptStore.isRunning = true
    abortControllers.value = []
    await runSlotStream(slot, prompts)
    promptStore.setResponses(markInFlightAsCancelled(promptStore.responses))

    if (payload.mcpInspection) {
      promptStore.updateResponse(slot.slotId, { mcpInspection: payload.mcpInspection })
    }

    if (promptStore.assertions.length) {
      const response = promptStore.responses.find(r => r.slotId === slot.slotId)
      if (response?.status === 'done') {
        promptStore.updateResponse(response.slotId, {
          assertionResults: evaluateAssertions(promptStore.assertions, response.content),
        })
      }
    }

    promptStore.isRunning = false
  }

  async function continueWithMcp(payload: {
    slotId: string
    toolName: string
    argumentsJson: string
    assistantContent: string
  }) {
    const inspection = await mcpStore.callEnabledTool(payload.toolName, payload.argumentsJson)
    if (inspection.error) {
      promptStore.updateResponse(payload.slotId, { mcpInspection: inspection })
      return
    }
    await continueWithTool({
      slotId: payload.slotId,
      toolName: payload.toolName,
      mockResultJson: inspection.resultJson,
      assistantContent: payload.assistantContent,
      mcpInspection: inspection,
    })
  }

  async function runBulkDataset(payload: { rows: Record<string, string>[], mapping: ColumnMapping }) {
    stopAll()
    bulkCancelled.value = false
    promptStore.isRunning = true
    abortControllers.value = []
    bulkJudgeAggregates.value = []
    bulkResults.value = payload.rows.map((row, index) => ({
      index,
      variables: applyColumnMapping(row, payload.mapping, { ...promptStore.variables }),
      status: 'pending',
      models: [],
    }))

    for (let i = 0; i < payload.rows.length; i++) {
      if (bulkCancelled.value) {
        for (let j = i; j < bulkResults.value.length; j++) {
          const pending = bulkResults.value[j]
          if (pending) pending.status = 'cancelled'
        }
        break
      }

      const caseResult = bulkResults.value[i]
      if (!caseResult) continue
      caseResult.status = 'running'
      bulkProgress.value = `Running row ${i + 1} of ${payload.rows.length}`

      const vars: PromptVariables = caseResult.variables
      const prompts = {
        systemPrompt: interpolateVariables(promptStore.systemPrompt, vars),
        userPrompt: interpolateVariables(promptStore.userPrompt, vars),
      }

      const modelResults = await Promise.all(
        providerStore.selectedModels.map(async (slot): Promise<BulkModelResult> => {
          const model = PROVIDER_MODELS.find(m => m.id === slot.modelId)
          const result = await runSlotStream(slot, prompts, { updateStore: false })
          const aborted = bulkCancelled.value || result.status === 'cancelled' || result.status === 'streaming' || result.status === 'idle'
          return {
            modelId: slot.modelId,
            label: model?.label ?? slot.modelId,
            status: result.status === 'done'
              ? 'done'
              : result.status === 'cancelled'
                ? 'cancelled'
                : 'error',
            latencyMs: result.latencyMs,
            outputPreview: truncatePreview(result.content),
            content: result.content,
            error: result.error ?? (aborted ? 'Cancelled' : undefined),
            costUsd: result.costUsd,
          }
        }),
      )

      if (promptStore.judge.enabled && !bulkCancelled.value) {
        bulkProgress.value = `Judging row ${i + 1} of ${payload.rows.length}`
        for (const modelResult of modelResults) {
          if (modelResult.status !== 'done' || bulkCancelled.value) continue
          const judgeResult = await scoreWithJudge({
            candidate: modelResult.content ?? '',
            variables: vars,
            userPrompt: prompts.userPrompt,
          })
          if (!judgeResult) continue
          modelResult.judgeOverall = judgeResult.overall
          modelResult.judgePass = judgeResult.pass
          modelResult.judgeRationale = judgeResult.rationale
          modelResult.judgeScoresJson = JSON.stringify(judgeResult.scores)
          modelResult.judgeError = judgeResult.parseError
          modelResult.judgeLatencyMs = judgeResult.latencyMs
          modelResult.judgeCostUsd = judgeResult.costUsd
        }
      }

      // Drop full content from persisted bulk rows to keep exports lean
      for (const modelResult of modelResults) {
        delete modelResult.content
      }

      caseResult.models = modelResults
      caseResult.status = bulkCancelled.value
        ? 'cancelled'
        : modelResults.some(m => m.status === 'error')
          ? 'error'
          : 'done'
    }

    refreshBulkJudgeAggregates()
    bulkProgress.value = bulkCancelled.value
      ? 'Bulk run stopped'
      : `Finished ${bulkResults.value.filter(r => r.status === 'done' || r.status === 'error').length} rows`
    promptStore.isRunning = false
  }

  function stopAll() {
    bulkCancelled.value = true
    abortControllers.value.forEach(c => c.abort())
    abortControllers.value = []
    if (promptStore.responses.some(r => r.status === 'streaming' || r.status === 'idle')) {
      promptStore.setResponses(markInFlightAsCancelled(promptStore.responses))
    }
    promptStore.isRunning = false
  }

  return {
    bulkResults,
    bulkProgress,
    bulkJudgeAggregates,
    canRun,
    runAll,
    continueWithTool,
    continueWithMcp,
    runBulkDataset,
    stopAll,
    clearBulkResults,
  }
}
