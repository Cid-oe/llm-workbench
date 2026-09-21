#!/usr/bin/env node
// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Nuxt's current toolchain is pinned to TypeScript 5.9.x in package.json until
// TypeScript 7 support is verified. Keep this exception explicit and narrow.
export const ALLOWED_MAJOR_DRIFT = new Set(['typescript'])

function majorVersion(version) {
  const match = /^v?(\d+)/.exec(version ?? '')
  return match ? Number(match[1]) : null
}

export function findMajorDrift(outdated, allowedMajorDrift = ALLOWED_MAJOR_DRIFT) {
  return Object.entries(outdated).flatMap(([name, info]) => {
    const current = majorVersion(info.current)
    const latest = majorVersion(info.latest)
    if (current === null || latest === null || latest - current <= 1 || allowedMajorDrift.has(name)) return []
    return [{ name, current: info.current, latest: info.latest }]
  })
}

export function formatReport(outdated, majorDrift, allowedMajorDrift = ALLOWED_MAJOR_DRIFT) {
  const names = Object.keys(outdated)
  const lines = [
    'Dependency freshness policy: patch/minor drift is informational; more than one major behind fails this job unless explicitly allowlisted.',
    `Outdated dependencies: ${names.length}`,
    `Allowlisted major drift: ${[...allowedMajorDrift].join(', ') || 'none'}`,
  ]

  if (majorDrift.length === 0) {
    lines.push('Major drift gate: PASS')
  } else {
    lines.push('Major drift gate: FAIL')
    for (const dependency of majorDrift) {
      lines.push(`- ${dependency.name}: ${dependency.current} -> ${dependency.latest}`)
    }
  }

  return lines.join('\n')
}

function main() {
  const reportPath = process.argv[2]
  if (!reportPath) {
    console.error('Usage: check-dependency-drift.mjs <npm-outdated.json>')
    process.exitCode = 2
    return
  }

  let outdated
  try {
    outdated = JSON.parse(readFileSync(reportPath, 'utf8'))
  } catch (error) {
    console.error(`Could not read npm outdated JSON: ${error.message}`)
    process.exitCode = 2
    return
  }

  const majorDrift = findMajorDrift(outdated)
  console.log(formatReport(outdated, majorDrift))
  if (majorDrift.length > 0) process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
