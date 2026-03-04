/**
 * @file tests/e2e/app-load.spec.ts
 *
 * ⚠️  DOCUMENTATION FILE — NOT A RUNNABLE TEST ⚠️
 *
 * This file is a reference document showing the per-app smoke test pattern
 * used across MMC, Backoffice, and Frontoffice.
 *
 * There is NO root playwright.config.ts — each app has its own config because
 * each app runs on a different port with a different baseURL.
 *
 * To run E2E tests, use the per-app commands:
 *   bun run test:e2e:mmc         → apps/mmc/playwright.config.ts (port 5173)
 *   bun run test:e2e:backoffice  → apps/backoffice/playwright.config.ts (port 5174)
 *   bun run test:e2e:frontoffice → apps/frontoffice/playwright.config.ts (port 5175)
 *   bun run test:e2e             → runs all 3 sequentially
 *
 * Per-App Smoke Test Pattern:
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import { test, expect } from '@playwright/test'
 *
 *   test('<AppName> app loads without errors', async ({ page }) => {
 *     await page.goto('/')
 *     await expect(page).not.toHaveTitle(/error/i)
 *     await expect(page.locator('body')).toBeVisible()
 *   })
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Per-App Smoke Tests:
 *   apps/mmc/tests/e2e/smoke.spec.ts         — MMC smoke test
 *   apps/backoffice/tests/e2e/smoke.spec.ts  — Backoffice smoke test
 *   apps/frontoffice/tests/e2e/smoke.spec.ts — Frontoffice smoke test
 *
 * Per-App Playwright Configs:
 *   apps/mmc/playwright.config.ts            — MMC config (baseURL: 5173)
 *   apps/backoffice/playwright.config.ts     — Backoffice config (baseURL: 5174)
 *   apps/frontoffice/playwright.config.ts    — Frontoffice config (baseURL: 5175)
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T035
 *
 * Note: This file is in tests/e2e/ which is EXCLUDED from Vitest discovery
 * (see vitest.workspace.ts: exclude: ['./tests/e2e/**']).
 * This file is intentionally NOT excluded from .gitignore so it serves
 * as on-disk documentation for contributors.
 */

// This file intentionally has no exports.
// It is a documentation-only file. Do not add test code here.
export {}
