// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { useI18n } from '~/composables/useI18n'

describe('useI18n', () => {
  it('returns English chrome strings', () => {
    const { locale, t } = useI18n()
    expect(locale).toBe('en')
    expect(t('nav.appName')).toBe('LLM Workbench')
    expect(t('skipToContent')).toBe('Skip to content')
    expect(t('nav.settings')).toBe('Settings')
    expect(t('mcp.title')).toBe('MCP servers')
    expect(t('judge.title')).toBe('LLM-as-a-Judge')
  })

  it('falls back to the key when a message is missing', () => {
    const { t } = useI18n()
    expect(t('does.not.exist')).toBe('does.not.exist')
  })
})
