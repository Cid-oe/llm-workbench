// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

/** SSR-safe wrappers around the browser Storage APIs. */

function nativeStorage(kind: 'local' | 'session'): Storage | undefined {
  if (!import.meta.client) return undefined
  const store = kind === 'local'
    ? (typeof localStorage === 'undefined' ? undefined : localStorage)
    : (typeof sessionStorage === 'undefined' ? undefined : sessionStorage)
  return store
}

function createBrowserStorage(kind: 'local' | 'session'): Storage {
  return {
    get length() {
      return nativeStorage(kind)?.length ?? 0
    },
    clear() {
      nativeStorage(kind)?.clear()
    },
    getItem(key: string) {
      return nativeStorage(kind)?.getItem(key) ?? null
    },
    key(index: number) {
      return nativeStorage(kind)?.key(index) ?? null
    },
    removeItem(key: string) {
      nativeStorage(kind)?.removeItem(key)
    },
    setItem(key: string, value: string) {
      nativeStorage(kind)?.setItem(key, value)
    },
  }
}

/** Pinia persist adapter for localStorage. */
export const localStore = createBrowserStorage('local')

/** Pinia persist adapter for sessionStorage. */
export const sessionStore = createBrowserStorage('session')
