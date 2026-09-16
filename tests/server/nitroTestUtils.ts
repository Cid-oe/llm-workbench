import { vi } from 'vitest'

export type NitroHandler = (event?: unknown) => unknown | Promise<unknown>

export function stubNitroGlobals(options: {
  body?: unknown
  setHeader?: (event: unknown, name: string, value: string) => void
} = {}) {
  vi.stubGlobal('defineEventHandler', <T>(handler: T) => handler)
  vi.stubGlobal('readBody', async () => options.body)
  vi.stubGlobal('createError', (opts: { statusCode: number, message: string }) => {
    const error = new Error(opts.message) as Error & { statusCode: number, statusMessage?: string }
    error.statusCode = opts.statusCode
    error.statusMessage = opts.message
    return error
  })
  vi.stubGlobal('setResponseHeader', options.setHeader ?? vi.fn())
}

export async function loadHandler(modulePath: string): Promise<NitroHandler> {
  const mod = await import(/* @vite-ignore */ modulePath)
  return mod.default as NitroHandler
}

export function textStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

export async function collectAsyncIterable(iterable: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = []
  for await (const chunk of iterable) out.push(chunk)
  return out
}
