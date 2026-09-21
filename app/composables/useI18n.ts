// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { en } from '~/i18n/en'

type NestedStringKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? NestedStringKeys<T[K], `${Prefix}${K}.`>
      : never
}[keyof T & string]

export type MessageKey = NestedStringKeys<typeof en>

function lookup(source: unknown, key: string): string | undefined {
  let current: unknown = source
  for (const part of key.split('.')) {
    if (current === null || typeof current !== 'object' || !(part in current)) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

/** English catalog today; extra locale files can be selected without rewriting call sites. */
export function useI18n() {
  const locale = 'en'
  function t(key: MessageKey | string, params?: Record<string, string | number>): string {
    let msg = lookup(en, key) ?? key
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        msg = msg.replaceAll(`{${name}}`, String(value))
      }
    }
    return msg
  }
  return { locale, t }
}
