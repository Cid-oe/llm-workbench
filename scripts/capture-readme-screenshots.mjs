// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

/**
 * One-off capture for docs/screenshots (issue #103).
 * Usage: node scripts/capture-readme-screenshots.mjs [baseURL]
 * Requires a running app (npm run dev or static serve).
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'docs', 'screenshots')
const baseURL = process.argv[2] || 'http://127.0.0.1:3000'

const models = [
  { slotId: 'slot-1', provider: 'groq', modelId: 'openai/gpt-oss-120b' },
  { slotId: 'slot-2', provider: 'gemini', modelId: 'gemini-3.6-flash' },
  { slotId: 'slot-3', provider: 'openai', modelId: 'gpt-4o-mini' },
  { slotId: 'slot-4', provider: 'anthropic', modelId: 'claude-3-5-haiku-20241022' },
]

const responseBodies = [
  'A qubit is like a spinning coin: until you look, it is both heads and tails at once (superposition). Measuring collapses it to 0 or 1. Entanglement links qubits so they act as one system.',
  'Think of a coin spinning on a table. Classical bits are heads or tails after it lands. Qubits stay in that spinning state and can represent many possibilities until measured.',
  'Quantum computing uses qubits that follow quantum mechanics. Unlike bits that are only 0 or 1, qubits can be in superposition — many states at once — which helps explore solutions in parallel.',
  'Qubits use superposition and entanglement. Superposition lets each qubit hold a blend of 0 and 1; entanglement correlates them so you can tackle hard search and optimization problems faster.',
]

function makeResponse(slot, content, metrics) {
  return {
    slotId: slot.slotId,
    provider: slot.provider,
    modelId: slot.modelId,
    content,
    status: 'done',
    metrics,
  }
}

function makeHistoryEntry(id, createdAt, metricScale) {
  const responses = models.map((slot, i) =>
    makeResponse(slot, responseBodies[i], {
      latencyMs: Math.round([3060, 3510, 2890, 4120][i] * metricScale),
      ttftMs: Math.round([262, 874, 410, 680][i] * metricScale),
      inputTokens: 22,
      outputTokens: Math.round([1418, 747, 920, 1105][i] * metricScale),
      costUsd: Number(([0.0009, 0.0004, 0.0003, 0.0011][i] * metricScale).toFixed(4)),
    }),
  )
  return {
    id,
    systemPrompt: 'You are a helpful assistant.',
    userPrompt: 'Explain {{topic}} in simple terms for a {{audience}}.',
    variables: { topic: 'quantum computing', audience: 'beginner' },
    models: [...models],
    responses,
    createdAt,
  }
}

const history = [
  makeHistoryEntry('hist-3', '2026-08-26T06:22:00.000Z', 1.0),
  makeHistoryEntry('hist-2', '2026-08-26T06:18:00.000Z', 1.35),
  makeHistoryEntry('hist-1', '2026-08-26T06:14:00.000Z', 1.15),
]

const latest = history[0]

const promptState = {
  systemPrompt: 'You are a helpful assistant.',
  userPrompt: 'Explain {{topic}} in simple terms for a {{audience}}.',
  variables: { topic: 'quantum computing', audience: 'beginner' },
  responses: latest.responses,
  isRunning: false,
  history,
  savedPrompts: [],
  generation: { temperature: 0.7, maxTokens: 4096 },
  assertions: [],
  toolSignatures: [],
}

const slotsState = { selectedModels: models }

const sessionKeys = {
  openaiKey: 'sk-demo-key-for-screenshots-only',
  anthropicKey: 'sk-ant-demo-key-for-screenshots',
  geminiKey: 'AIzaDemoKeyForScreenshotsOnly',
  groqKey: 'gsk_demo_key_for_screenshots_only',
}

async function seedStorage(page) {
  await page.addInitScript(
    ({ promptState, slotsState, sessionKeys }) => {
      localStorage.setItem('prompt', JSON.stringify(promptState))
      localStorage.setItem('provider-slots', JSON.stringify(slotsState))
      localStorage.setItem('provider-persist-v2', '1')
      sessionStorage.setItem('provider-session', JSON.stringify(sessionKeys))
    },
    { promptState, slotsState, sessionKeys },
  )
}

async function waitReady(page) {
  await page.waitForSelector('text=LLM Workbench', { timeout: 60_000 })
  // Hide Nuxt DevTools / floating widgets if present
  await page.addStyleTag({
    content: `
      #nuxt-devtools-container,
      .nuxt-devtools-frame,
      [data-v-inspector],
      .vue-devtools__anchor {
        display: none !important;
      }
    `,
  }).catch(() => {})
  await page.waitForTimeout(400)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
    deviceScaleFactor: 1,
  })
  const page = await desktop.newPage()
  await seedStorage(page)

  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await waitReady(page)
  // Full-page compare with seeded responses
  await page.screenshot({
    path: path.join(outDir, 'playground.png'),
    fullPage: true,
  })

  await page.goto(`${baseURL.replace(/\/$/, '')}/metrics`, { waitUntil: 'networkidle' })
  await waitReady(page)
  await page.getByRole('button', { name: /Historical avg/i }).click().catch(() => {})
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.join(outDir, 'metrics.png'),
    fullPage: true,
  })

  await page.goto(`${baseURL.replace(/\/$/, '')}/history`, { waitUntil: 'networkidle' })
  await waitReady(page)
  await page.screenshot({
    path: path.join(outDir, 'history.png'),
    fullPage: false,
  })

  await page.goto(`${baseURL.replace(/\/$/, '')}/settings`, { waitUntil: 'networkidle' })
  await waitReady(page)
  await page.screenshot({
    path: path.join(outDir, 'settings.png'),
    fullPage: false,
  })

  await desktop.close()

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  })
  const mPage = await mobile.newPage()
  await seedStorage(mPage)
  await mPage.goto(baseURL, { waitUntil: 'networkidle' })
  await waitReady(mPage)
  await mPage.getByRole('button', { name: /Open menu/i }).click()
  await mPage.waitForTimeout(300)
  await mPage.screenshot({
    path: path.join(outDir, 'mobile-menu.png'),
    fullPage: false,
  })

  await mobile.close()
  await browser.close()
  console.log('Wrote screenshots to', outDir)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
