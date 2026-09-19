// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow `merge:` for conflict-resolution commits on PR branches (see CI commitlint job).
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'merge',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
      ],
    ],
  },
}
