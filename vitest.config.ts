// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const appDir = fileURLToPath(new URL('./app', import.meta.url))

export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.client': true,
  },
  resolve: {
    alias: {
      '~': appDir,
      '~/': `${appDir}/`,
    },
  },
  test: {
    environment: 'happy-dom',
    // threads + shared env: less happy-dom spin-up vs per-file forks isolation.
    // setup.ts resets storage each test; keep tests free of cross-file leaks.
    pool: 'threads',
    isolate: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'app/lib/**/*.ts',
        'app/composables/**/*.ts',
        'app/stores/**/*.ts',
        'server/**/*.ts',
        'app/pages/index.vue',
        'app/pages/history.vue',
        'app/pages/metrics.vue',
        'app/components/metrics/LatencyTimeline.vue',
        'app/components/playground/PromptVersionDiff.vue',
      ],
      // Global gates (not per-file). Unmet thresholds make Vitest exit non-zero → CI fails.
      // OpenSSF Gold: ≥90% statements (test_statement_coverage90), ≥80% branches
      // (test_branch_coverage80).
      thresholds: {
        perFile: false,
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 80,
      },
    },
  },
})
