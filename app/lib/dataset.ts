// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import * as v from 'valibot'
import type { PromptVariables, StreamStatus } from '~/types/llm'
import { MAX_DATASET_ROWS } from '~/lib/datasetLimits'
import { datasetJsonSchema, firstSchemaIssue } from '~/lib/schemas/dataset'

export { MAX_DATASET_ROWS }

export class DatasetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatasetError'
  }
}

export interface DatasetTable {
  columns: string[]
  rows: Record<string, string>[]
  source: 'csv' | 'json'
}

/** Maps prompt variable name → dataset column name */
export type ColumnMapping = Record<string, string>

export interface BulkModelResult {
  modelId: string
  label: string
  status: StreamStatus
  latencyMs: number
  outputPreview: string
  error?: string
}

export interface BulkCaseResult {
  index: number
  variables: PromptVariables
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled'
  models: BulkModelResult[]
}

export function detectDatasetFormat(content: string, filename = ''): 'csv' | 'json' {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.csv')) return 'csv'
  const trimmed = content.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json'
  return 'csv'
}

export function parseDataset(content: string, filename = ''): DatasetTable {
  const source = detectDatasetFormat(content, filename)
  if (source === 'json') return parseJsonDataset(content)
  return parseCsvDataset(content)
}

export function parseJsonDataset(content: string): DatasetTable {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  }
  catch {
    throw new DatasetError('Invalid JSON dataset')
  }

  const result = v.safeParse(datasetJsonSchema, parsed)
  if (!result.success) {
    throw new DatasetError(firstSchemaIssue(result.issues))
  }

  const rowsRaw = result.output
  const rows: Record<string, string>[] = []
  const columnSet = new Set<string>()

  for (const item of rowsRaw) {
    const row: Record<string, string> = {}
    for (const [key, value] of Object.entries(item)) {
      columnSet.add(key)
      row[key] = value == null ? '' : String(value)
    }
    rows.push(row)
  }

  return { columns: [...columnSet], rows, source: 'json' }
}

export function parseCsvDataset(content: string): DatasetTable {
  const matrix = parseCsvMatrix(content)
  if (matrix.length < 2) throw new DatasetError('CSV needs a header row and at least one data row')

  const header = matrix[0]!.map(cell => cell.trim())
  if (header.some(h => !h) || new Set(header).size !== header.length) {
    throw new DatasetError('CSV header must contain unique non-empty column names')
  }

  const dataRows = matrix.slice(1).filter(row => row.some(cell => cell.trim() !== ''))
  if (!dataRows.length) throw new DatasetError('CSV has no data rows')
  if (dataRows.length > MAX_DATASET_ROWS) {
    throw new DatasetError(`Dataset exceeds the ${MAX_DATASET_ROWS}-row limit`)
  }

  const rows = dataRows.map((cells) => {
    const row: Record<string, string> = {}
    header.forEach((col, i) => {
      row[col] = (cells[i] ?? '').trim()
    })
    return row
  })

  return { columns: header, rows, source: 'csv' }
}

/** Auto-map variables to columns by case-insensitive name match. */
export function autoMapColumns(columns: string[], variables: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const lower = new Map(columns.map(c => [c.toLowerCase(), c]))
  for (const variable of variables) {
    const column = lower.get(variable.toLowerCase())
    if (column) mapping[variable] = column
  }
  return mapping
}

export function applyColumnMapping(
  row: Record<string, string>,
  mapping: ColumnMapping,
  base: PromptVariables = {},
): PromptVariables {
  const next: PromptVariables = { ...base }
  for (const [variable, column] of Object.entries(mapping)) {
    if (!column) continue
    next[variable] = row[column] ?? ''
  }
  return next
}

export function truncatePreview(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max - 1)}…`
}

export function serializeBulkResultsJson(results: BulkCaseResult[]): string {
  return `${JSON.stringify(results, null, 2)}\n`
}

export function serializeBulkResultsCsv(results: BulkCaseResult[]): string {
  const modelIds = [...new Set(results.flatMap(r => r.models.map(m => m.modelId)))]
  const varKeys = [...new Set(results.flatMap(r => Object.keys(r.variables)))]
  const headers = [
    'index',
    'status',
    ...varKeys.map(k => `var_${k}`),
    ...modelIds.flatMap(id => [`${id}_status`, `${id}_latency_ms`, `${id}_preview`, `${id}_error`]),
  ]

  const lines = [headers.map(escapeCsv).join(',')]
  for (const result of results) {
    const byModel = new Map(result.models.map(m => [m.modelId, m]))
    const cells: string[] = [
      String(result.index + 1),
      result.status,
      ...varKeys.map(k => result.variables[k] ?? ''),
    ]
    for (const id of modelIds) {
      const model = byModel.get(id)
      cells.push(
        model?.status ?? '',
        model ? String(Math.round(model.latencyMs)) : '',
        model?.outputPreview ?? '',
        model?.error ?? '',
      )
    }
    lines.push(cells.map(escapeCsv).join(','))
  }
  return `${lines.join('\n')}\n`
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function parseCsvMatrix(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  const pushCell = () => {
    row.push(cell)
    cell = ''
  }
  const pushRow = () => {
    pushCell()
    rows.push(row)
    row = []
  }

  const text = content.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    const next = text[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      }
      else if (ch === '"') {
        inQuotes = false
      }
      else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    }
    else if (ch === ',') {
      pushCell()
    }
    else if (ch === '\n') {
      pushRow()
    }
    else if (ch === '\r') {
      if (next === '\n') i++
      pushRow()
    }
    else {
      cell += ch
    }
  }

  if (cell.length || row.length) pushRow()
  return rows
}
