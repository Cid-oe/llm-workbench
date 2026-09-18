// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

export type DiffKind = 'equal' | 'add' | 'remove'

export interface DiffLine {
  kind: DiffKind
  text: string
}

export function splitLines(text: string): string[] {
  if (text === '') return ['']
  return text.split('\n')
}

export function formatPromptForDiff(systemPrompt: string, userPrompt: string): string {
  return `## System\n${systemPrompt}\n\n## User\n${userPrompt}`
}

/** Line-level LCS diff for prompt drift highlighting. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = splitLines(before)
  const b = splitLines(after)
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j]
        ? (dp[i + 1]![j + 1]! + 1)
        : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'equal', text: a[i]! })
      i++
      j++
    }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ kind: 'remove', text: a[i]! })
      i++
    }
    else {
      out.push({ kind: 'add', text: b[j]! })
      j++
    }
  }
  while (i < n) {
    out.push({ kind: 'remove', text: a[i]! })
    i++
  }
  while (j < m) {
    out.push({ kind: 'add', text: b[j]! })
    j++
  }
  return out
}

/** Pair LCS hunks into left/right rows for a split (side-by-side) view. */
export interface SplitDiffRow {
  left: DiffLine | null
  right: DiffLine | null
}

export function toSplitDiffRows(hunks: DiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = []
  let i = 0
  while (i < hunks.length) {
    const line = hunks[i]!
    if (line.kind === 'equal') {
      rows.push({ left: line, right: line })
      i++
      continue
    }
    if (line.kind === 'remove') {
      const next = hunks[i + 1]
      if (next?.kind === 'add') {
        rows.push({ left: line, right: next })
        i += 2
      }
      else {
        rows.push({ left: line, right: null })
        i++
      }
      continue
    }
    rows.push({ left: null, right: line })
    i++
  }
  return rows
}
