// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import * as v from 'valibot'
import { MAX_DATASET_ROWS } from '~/lib/datasetLimits'

const datasetRowSchema = v.pipe(
  v.unknown(),
  v.check(
    item => !!item && typeof item === 'object' && !Array.isArray(item),
    'Each JSON row must be an object',
  ),
  v.transform(item => item as Record<string, unknown>),
)

const rowsArraySchema = v.pipe(
  v.array(datasetRowSchema, 'JSON dataset must be an array of objects or { "rows": [...] }'),
  v.check(rows => rows.length > 0, 'Dataset has no rows'),
  v.check(
    rows => rows.length <= MAX_DATASET_ROWS,
    `Dataset exceeds the ${MAX_DATASET_ROWS}-row limit`,
  ),
)

/** JSON dataset: array of row objects or `{ rows: [...] }`. */
export const datasetJsonSchema = v.pipe(
  v.union(
    [
      rowsArraySchema,
      v.pipe(
        v.object({
          rows: rowsArraySchema,
        }, 'JSON dataset must be an array of objects or { "rows": [...] }'),
        v.transform(value => value.rows),
      ),
    ],
    'JSON dataset must be an array of objects or { "rows": [...] }',
  ),
)

export function firstSchemaIssue(issues: v.BaseIssue<unknown>[]): string {
  return issues[0]?.message ?? 'Invalid input'
}
