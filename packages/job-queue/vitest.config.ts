import { defineProject } from 'vitest/config'

/**
 * packages/job-queue — Minimal Vitest Project Config
 *
 * Job queue shared types package — no unit tests at this time.
 * Config present to satisfy vitest workspace autodiscovery.
 */
export default defineProject({
  test: {
    name: 'job-queue',
    globals: true,
    environment: 'node',
    include: ['./tests/**/*.spec.ts', './tests/**/*.test.ts'],
  },
})
