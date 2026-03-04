import { defineConfig, devices } from '@playwright/test'

/**
 * apps/mmc — Playwright E2E Configuration
 *
 * Smoke tests for the MMC (Platform Control Panel) Vue 3 SPA.
 * Runs against a local dev server on port 5173.
 *
 * Start dev server with: bun run dev:mmc
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T029
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.MMC_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
