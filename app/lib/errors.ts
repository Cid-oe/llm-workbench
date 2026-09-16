import type { ProviderId } from '~/types/llm'

export type StreamErrorCode =
  | 'validation'
  | 'http'
  | 'network'
  | 'no_stream'
  | 'unknown'

export interface StreamErrorOptions {
  message: string
  code: StreamErrorCode
  provider?: ProviderId
  status?: number
  cause?: unknown
}

/**
 * Typed failure for provider / stream paths.
 * Prefer {@link StreamError.toLogFields} (or pass the instance to the logger via
 * `error: streamError.toLogFields()`) so secrets in `cause` are not serialized raw.
 */
export class StreamError extends Error {
  readonly code: StreamErrorCode
  readonly provider?: ProviderId
  readonly status?: number
  override readonly cause?: unknown

  constructor(options: StreamErrorOptions) {
    super(options.message)
    this.name = 'StreamError'
    this.code = options.code
    this.provider = options.provider
    this.status = options.status
    this.cause = options.cause
  }

  /** Safe JSON-ish payload for structured logs (no raw cause object). */
  toLogFields(): Record<string, unknown> {
    const fields: Record<string, unknown> = {
      code: this.code,
      message: this.message,
    }
    if (this.provider) fields.provider = this.provider
    if (this.status != null) fields.status = this.status
    if (this.cause !== undefined) {
      fields.cause = summarizeCause(this.cause)
    }
    return fields
  }

  toJSON(): Record<string, unknown> {
    return this.toLogFields()
  }
}

export function isStreamError(value: unknown): value is StreamError {
  return value instanceof StreamError
}

function summarizeCause(cause: unknown): string {
  if (cause instanceof StreamError) return cause.message
  if (cause instanceof Error) return cause.message
  if (typeof cause === 'string') return cause
  return 'unknown'
}
