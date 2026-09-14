export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEvent {
  level: LogLevel
  message: string
  timestamp: string
  [key: string]: unknown
}

export type LogSink = (event: LogEvent) => void

const SENSITIVE_KEYS = /api[_-]?key|authorization|password|secret|token|verifier/i

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.test(key) ? '[redacted]' : redact(nested)
    }
    return out
  }
  return value
}

function defaultSink(event: LogEvent): void {
  const line = JSON.stringify(event)
  if (event.level === 'error') console.error(line)
  else if (event.level === 'warn') console.warn(line)
  else console.info(line)
}

const sinks: LogSink[] = [defaultSink]

export function addLogSink(sink: LogSink): () => void {
  sinks.push(sink)
  return () => {
    const index = sinks.indexOf(sink)
    if (index >= 0) sinks.splice(index, 1)
  }
}

export function log(level: LogLevel, message: string, extra: Record<string, unknown> = {}): LogEvent {
  const event: LogEvent = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(redact(extra) as Record<string, unknown>),
  }

  for (const sink of sinks) sink(event)
  return event
}

export const logger = {
  debug: (message: string, extra?: Record<string, unknown>) => log('debug', message, extra),
  info: (message: string, extra?: Record<string, unknown>) => log('info', message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => log('warn', message, extra),
  error: (message: string, extra?: Record<string, unknown>) => log('error', message, extra),
}
