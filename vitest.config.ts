import { defineConfig } from 'vitest/config'

/**
 * Root Vitest Configuration — Projects-Based Orchestrator
 *
 * This is the global orchestrator config. Test project discovery and
 * per-project settings are defined in vitest.workspace.ts.
 *
 * This file provides:
 * - workspace: points to vitest.workspace.ts for project discovery
 * - coverage: centralized coverage config (no per-project coverage)
 *
 * Resolve aliases and per-project settings are in vitest.workspace.ts.
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T001
 */
export default defineConfig({
  test: {
    // Workspace config: orchestrates all app and package projects
    workspace: './vitest.workspace.ts',
    // Centralized coverage — no per-project coverage config
    coverage: {
      // Vitest v1 enables coverage.all by default, which makes partial project
      // runs count unrelated workspace files as 0% covered.
      all: false,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '**/tests/**',
        'scripts/**',
        '**/*.d.ts',
        '**/vitest.config.ts',
        '**/vitest.workspace.ts',
        '**/playwright.config.ts',
        '**/*.config.{ts,mjs,js}',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 80,
      },
    },
  },
})
