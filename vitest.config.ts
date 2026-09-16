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
      thresholds: {
        lines: 60,
        functions: 60,
        statements: 60,
      },
    },
  },
})
