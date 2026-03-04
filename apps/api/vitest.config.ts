import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineProject } from 'vitest/config'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

/**
 * apps/api — Minimal Vitest Project Override
 *
 * Node environment, globals, setupFiles, include patterns.
 * Includes API-specific test directories only (not root tests/).
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T006
 */
export default defineProject({
  resolve: {
    alias: [
      {
        find: /^@zidney\/domain-core\/(.*)$/,
        replacement: resolve(__dirname, '../../packages/domain-core/src/$1'),
      },
      {
        find: '@zidney/domain-core',
        replacement: resolve(
          __dirname,
          '../../packages/domain-core/src/index.ts'
        ),
      },
      {
        find: '@zidney/logger',
        replacement: resolve(__dirname, '../../packages/logger/src/index.ts'),
      },
      {
        find: '@zidney/types',
        replacement: resolve(__dirname, '../../packages/types/src/index.ts'),
      },
      {
        find: '@zidney/validation',
        replacement: resolve(
          __dirname,
          '../../packages/validation/src/index.ts'
        ),
      },
      {
        find: '@zidney/redis-utils',
        replacement: resolve(
          __dirname,
          '../../packages/redis-utils/src/index.ts'
        ),
      },
      {
        find: '@zidney/config',
        replacement: resolve(__dirname, '../../packages/config/src/index.ts'),
      },
    ],
  },
  test: {
    name: 'api',
    globals: true,
    environment: 'node',
    setupFiles: ['../../tests/vitest.setup.ts'],
    include: [
      './src/**/*.test.ts',
      './tests/unit/**/*.test.ts',
      './tests/integration/**/*.test.ts',
    ],
  },
})
