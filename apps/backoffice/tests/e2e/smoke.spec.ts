import { expect, test } from '@playwright/test'

/**
 * Backoffice — Smoke Test
 *
 * Verifies the Backoffice app loads and renders the login or root route.
 * Requires dev server running on port 5174.
 *
 * Start with: bun run dev:backoffice
 * Run with: bun run test:e2e:backoffice
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T033
 */
test('Backoffice app loads and renders root route', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
  // App renders either the login page or the authenticated root route
  await expect(page).not.toHaveTitle(/error/i)
})
