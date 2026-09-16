import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch, watchEffect } from 'vue'
import { beforeEach, vi } from 'vitest'
import { useCodeExporter } from '../app/composables/useCodeExporter'
import { useCostCalculator } from '../app/composables/useCostCalculator'
import { usePromptStore } from '../app/stores/usePromptStore'
import { useProviderStore } from '../app/stores/useProviderStore'
import { useSecurityStore } from '../app/stores/useSecurityStore'

vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('watch', watch)
vi.stubGlobal('watchEffect', watchEffect)
vi.stubGlobal('nextTick', nextTick)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useCostCalculator', useCostCalculator)
vi.stubGlobal('useCodeExporter', useCodeExporter)
vi.stubGlobal('usePromptStore', usePromptStore)
vi.stubGlobal('useProviderStore', useProviderStore)
vi.stubGlobal('useSecurityStore', useSecurityStore)

const memory = new Map<string, string>()

beforeEach(() => {
  memory.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value) },
    removeItem: (key: string) => { memory.delete(key) },
    clear: () => { memory.clear() },
  })
})
