import { expect, test } from '@playwright/test'

/**
 * Frontoffice — Smoke Test
 *
 * Verifies the Frontoffice app loads and renders the root route.
 * Requires dev server running on port 5175.
 *
 * Start with: bun run dev:frontoffice
 * Run with: bun run test:e2e:frontoffice
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T034
 */
test('Frontoffice app loads and renders root route', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
  await expect(page).not.toHaveTitle(/error/i)
})
