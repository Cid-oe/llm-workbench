import { describe, expect, it } from 'vitest'
import {
  MAX_DATASET_ROWS,
  applyColumnMapping,
  autoMapColumns,
  parseDataset,
  serializeBulkResultsCsv,
  serializeBulkResultsJson,
  truncatePreview,
  type BulkCaseResult,
} from '../app/lib/dataset'

describe('dataset', () => {
  it('parses CSV with headers and maps variables', () => {
    const table = parseDataset('topic,audience\nquantum,beginner\n"hello, world",expert\n', 'cases.csv')
    expect(table.source).toBe('csv')
    expect(table.columns).toEqual(['topic', 'audience'])
    expect(table.rows).toHaveLength(2)
    expect(table.rows[1]).toEqual({ topic: 'hello, world', audience: 'expert' })

    const mapping = autoMapColumns(table.columns, ['topic', 'audience', 'extra'])
    expect(mapping).toEqual({ topic: 'topic', audience: 'audience' })
    expect(applyColumnMapping(table.rows[0]!, mapping, { extra: 'keep' })).toEqual({
      extra: 'keep',
      topic: 'quantum',
      audience: 'beginner',
    })
  })

  it('parses JSON array and { rows } shapes', () => {
    const a = parseDataset(JSON.stringify([{ topic: 'a' }, { topic: 'b', audience: 'x' }]), 'x.json')
    expect(a.rows).toHaveLength(2)
    expect(a.columns.sort()).toEqual(['audience', 'topic'])

    const b = parseDataset(JSON.stringify({ rows: [{ topic: 'c' }] }), 'y.json')
    expect(b.rows[0]?.topic).toBe('c')
  })

  it('rejects empty and oversized datasets', () => {
    expect(() => parseDataset('topic\n', 'a.csv')).toThrow(/header row and at least one data row/i)
    expect(() => parseDataset('[]', 'a.json')).toThrow(/no rows/i)

    const rows = Array.from({ length: MAX_DATASET_ROWS + 1 }, (_, i) => ({ topic: String(i) }))
    expect(() => parseDataset(JSON.stringify(rows), 'big.json')).toThrow(new RegExp(`${MAX_DATASET_ROWS}-row`))
  })

  it('rejects invalid JSON and non-object rows', () => {
    expect(() => parseDataset('{', 'bad.json')).toThrow(/invalid json/i)
    expect(() => parseDataset(JSON.stringify([1, 2]), 'bad.json')).toThrow(/object/i)
  })

  it('serializes bulk results and truncates previews', () => {
    expect(truncatePreview('a'.repeat(200)).endsWith('…')).toBe(true)

    const results: BulkCaseResult[] = [{
      index: 0,
      variables: { topic: 'quantum' },
      status: 'done',
      models: [{
        modelId: 'gpt-4o-mini',
        label: 'GPT',
        status: 'done',
        latencyMs: 12.4,
        outputPreview: 'Hello',
      }],
    }]

    expect(serializeBulkResultsJson(results)).toContain('"topic": "quantum"')
    const csv = serializeBulkResultsCsv(results)
    expect(csv).toContain('index,status,var_topic,gpt-4o-mini_status')
    expect(csv).toContain('1,done,quantum,done,12,Hello,')
  })
})
