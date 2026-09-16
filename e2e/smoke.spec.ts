import { expect, test } from '@playwright/test'

/** Provider / local LLM hosts — smoke must never hit the real network for these. */
const BLOCKED_HOST = /(?:^|[/.])(?:api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.groq\.com|localhost:11434|127\.0\.0\.1:11434|localhost:1234|127\.0\.0\.1:1234)(?:[:/]|$)/i

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (BLOCKED_HOST.test(url)) {
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })
})

test('static smoke: Compare home, Settings vault, History empty', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Compare' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'LLM Workbench' })).toBeVisible()

  await page.getByRole('navigation').getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByText('Encrypted API key vault')).toBeVisible()

  await page.getByRole('navigation').getByRole('link', { name: 'History' }).click()
  await expect(page.getByRole('heading', { name: 'History & Library' })).toBeVisible()
  await expect(page.getByText('No executions yet. Run a prompt from Compare.')).toBeVisible()
})
