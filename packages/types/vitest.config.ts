import { defineProject } from 'vitest/config'

/**
 * packages/types — Minimal Vitest Project Override
 *
 * Pure TypeScript type definitions — no dependencies on other packages.
 * Node environment, globals.
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T012
 */
export default defineProject({
  test: {
    name: 'types',
    globals: true,
    environment: 'node',
    include: ['./tests/unit/**/*.spec.ts', './tests/unit/**/*.test.ts'],
  },
})
