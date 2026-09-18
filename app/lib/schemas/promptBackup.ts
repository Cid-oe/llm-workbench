import * as v from 'valibot'

export const PROMPT_BACKUP_VERSION = 1 as const

/**
 * Top-level backup envelope. Entry scrubbing stays in promptBackup.ts;
 * this schema fail-closes on wrong version / non-object.
 * Field names never include secrets — apiKey is not part of the backup format.
 */
export const promptBackupSchema = v.object({
  version: v.literal(PROMPT_BACKUP_VERSION, 'Unsupported backup version'),
  exportedAt: v.optional(v.string()),
  history: v.optional(v.pipe(
    v.unknown(),
    v.transform((value): unknown[] => Array.isArray(value) ? value : []),
  )),
  savedPrompts: v.optional(v.pipe(
    v.unknown(),
    v.transform((value): unknown[] => Array.isArray(value) ? value : []),
  )),
}, 'Backup must be a JSON object')

export function firstSchemaIssue(issues: v.BaseIssue<unknown>[]): string {
  const issue = issues[0]
  if (!issue) return 'Invalid input'
  if (issue.message === 'Unsupported backup version') {
    return `Unsupported backup version: ${String(issue.input)}`
  }
  return issue.message
}
