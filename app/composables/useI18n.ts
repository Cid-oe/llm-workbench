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
  function t(key: MessageKey | string): string {
    return lookup(en, key) ?? key
  }
  return { locale, t }
}
