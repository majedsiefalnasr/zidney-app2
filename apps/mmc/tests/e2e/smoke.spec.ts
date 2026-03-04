import { expect, test } from '@playwright/test'

/**
 * MMC — Smoke Test
 *
 * Verifies the MMC app loads without errors.
 * Requires dev server running on port 5173.
 *
 * Start with: bun run dev:mmc
 * Run with: bun run test:e2e:mmc
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T032
 */
test('MMC app loads without errors', async ({ page }) => {
  await page.goto('/')
  await expect(page).not.toHaveTitle(/error/i)
  await expect(page.locator('body')).toBeVisible()
})
