import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

/**
 * apps/worker — Minimal Vitest Project Override
 *
 * Node environment, globals, setupFiles, include patterns.
 * Excludes load-testing tests (those belong in test:performance).
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T007
 */
export default defineProject({
  resolve: {
    alias: [
      {
        find: '@zidney/logger',
        replacement: resolve(__dirname, '../../packages/logger/src/index.ts'),
      },
      {
        find: '@zidney/types',
        replacement: resolve(__dirname, '../../packages/types/src/index.ts'),
      },
      {
        find: '@zidney/redis-utils',
        replacement: resolve(__dirname, '../../packages/redis-utils/src/index.ts'),
      },
      {
        find: '@zidney/domain-core',
        replacement: resolve(__dirname, '../../packages/domain-core/src/index.ts'),
      },
      {
        find: '@zidney/config',
        replacement: resolve(__dirname, '../../packages/config/src/index.ts'),
      },
    ],
  },
  test: {
    name: 'worker',
    globals: true,
    environment: 'node',
    setupFiles: ['../../tests/vitest.setup.ts'],
    include: ['./src/**/*.test.ts', './tests/unit/**/*.test.ts'],
    // Exclude load-testing tests — those belong in test:performance
    exclude: ['**/load-testing.test.ts', '**/tests/load/**'],
  },
})
