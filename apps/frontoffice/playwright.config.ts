import { defineConfig, devices } from '@playwright/test'

/**
 * apps/frontoffice — Playwright E2E Configuration
 *
 * Smoke tests for the Frontoffice (Student Runtime) Vue 3 SPA.
 * Runs against a local dev server on port 5175.
 *
 * Start dev server with: bun run dev:frontoffice
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T031
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.FRONTOFFICE_BASE_URL ?? 'http://localhost:5175',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
