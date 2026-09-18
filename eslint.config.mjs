// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  files: ['app/**/*.{js,ts,vue}', 'server/**/*.{js,ts}', 'tests/**/*.ts'],
  rules: {
    'no-console': 'off',
  },
})
