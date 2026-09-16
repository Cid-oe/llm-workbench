import type { StreamRequest } from '~/types/llm'
import {
  resolveStreamEndpoint,
  streamCompletionDirect,
  streamCompletionViaProxy,
  type StreamCallbacks,
} from '~/lib/streamClient'
import { buildProviderRequest } from '~/lib/streamProviders'

export type { StreamCallbacks }

export function useLLMStream() {
  const providerStore = useProviderStore()

  async function streamCompletion(
    request: StreamRequest,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    if (providerStore.airGapped && providerStore.streamProxyUrl) {
      throw new Error('Air-gapped mode disables the stream proxy')
    }

    const preview = buildProviderRequest(request)
    providerStore.assertRequestAllowed(request.provider, preview.url)

    const endpoint = resolveStreamEndpoint(providerStore.streamProxyUrl)

    if (endpoint) {
      await streamCompletionViaProxy(endpoint, request, callbacks, signal)
      return
    }

    await streamCompletionDirect(request, callbacks, signal)
  }

  return { streamCompletion }
}
