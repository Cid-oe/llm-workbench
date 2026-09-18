// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

/**
 * Fail if commits in a git range lack a DCO Signed-off-by trailer.
 *
 * Usage:
 *   node scripts/check-dco.mjs <range>
 *   BASE=<sha> HEAD=<sha> node scripts/check-dco.mjs
 *
 * Merge commits are skipped. Dependabot is exempted by the CI job `if:`.
 */
import { execSync } from 'node:child_process'

/**
 * @param {string} message
 * @returns {boolean}
 */
export function hasSignedOffBy(message) {
  return /^Signed-off-by: .+ <[^>]+>$/m.test(message)
}

/**
 * @param {string} gitLog
 * @returns {string[]} subject lines of commits missing DCO
 */
export function findMissingDco(gitLog) {
  const missing = []
  const commits = gitLog.split('\0').map(block => block.trim()).filter(Boolean)
  for (const block of commits) {
    const nl = block.indexOf('\n')
    const subject = nl === -1 ? block : block.slice(0, nl)
    const body = nl === -1 ? '' : block.slice(nl + 1)
    if (/^Merge /i.test(subject)) continue
    if (!hasSignedOffBy(`${subject}\n${body}`)) missing.push(subject)
  }
  return missing
}

function gitRange() {
  if (process.env.BASE && process.env.HEAD) return `${process.env.BASE}..${process.env.HEAD}`
  if (process.argv[2]) return process.argv[2]
  return null
}

function main() {
  const range = gitRange()
  if (!range) {
    console.error('Usage: node scripts/check-dco.mjs <git-range>')
    console.error('   or: BASE=<sha> HEAD=<sha> node scripts/check-dco.mjs')
    process.exit(2)
  }

  const gitLog = execSync(`git log --format=%s%n%b%x00 ${range}`, { encoding: 'utf8' })
  const missing = findMissingDco(gitLog)
  if (missing.length) {
    console.error('Missing DCO Signed-off-by on:')
    for (const subject of missing) console.error(` - ${subject}`)
    console.error('\nSign off with: git commit --amend -s')
    console.error('See CONTRIBUTING.md#developer-certificate-of-origin-dco')
    process.exit(1)
  }
  console.log('DCO OK')
}

const invokedDirectly = process.argv[1] && process.argv[1].replaceAll('\\', '/').endsWith('scripts/check-dco.mjs')
if (invokedDirectly) main()
