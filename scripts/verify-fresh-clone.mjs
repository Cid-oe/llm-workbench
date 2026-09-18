#!/usr/bin/env node
// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

/**
 * Fresh-clone verification: install from lockfile, build, run unit coverage.
 * Fails closed (non-zero exit) on any step failure.
 *
 * Usage:
 *   node scripts/verify-fresh-clone.mjs
 *   npm run verify:fresh
 *
 * Does not call live LLM providers or Ollama — Vitest uses happy-dom + mocks.
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const steps = [
  { title: 'npm ci', command: 'npm', args: ['ci'] },
  { title: 'npm run build', command: 'npm', args: ['run', 'build'] },
  { title: 'npm run test:coverage', command: 'npm', args: ['run', 'test:coverage'] },
]

function run(step) {
  console.log(`\n==> ${step.title}\n`)
  const result = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  if (result.status !== 0) {
    console.error(`\nverify-fresh-clone failed at: ${step.title} (exit ${result.status ?? 'unknown'})`)
    process.exit(result.status ?? 1)
  }
}

console.log('verify-fresh-clone: starting clean install → build → coverage')
for (const step of steps) run(step)
console.log('\nverify-fresh-clone: OK')
