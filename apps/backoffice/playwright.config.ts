import { defineConfig, devices } from '@playwright/test'

/**
 * apps/backoffice — Playwright E2E Configuration
 *
 * Smoke tests for the Backoffice (Institution Control Panel) Vue 3 SPA.
 * Runs against a local dev server on port 5174.
 *
 * Start dev server with: bun run dev:backoffice
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T030
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BACKOFFICE_BASE_URL ?? 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
