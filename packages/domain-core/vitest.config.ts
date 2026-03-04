import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineProject } from 'vitest/config'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

/**
 * packages/domain-core — Minimal Vitest Project Override
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T008
 */
export default defineProject({
  resolve: {
    alias: [
      {
        find: '@zidney/types',
        replacement: resolve(__dirname, '../types/src/index.ts'),
      },
      {
        find: '@zidney/logger',
        replacement: resolve(__dirname, '../logger/src/index.ts'),
      },
      {
        find: '@zidney/validation',
        replacement: resolve(__dirname, '../validation/src/index.ts'),
      },
      {
        find: '@zidney/config',
        replacement: resolve(__dirname, '../config/src/index.ts'),
      },
      {
        find: '@zidney/redis-utils',
        replacement: resolve(__dirname, '../redis-utils/src/index.ts'),
      },
    ],
  },
  test: {
    name: 'domain-core',
    globals: true,
    environment: 'node',
    include: [
      './tests/unit/**/*.spec.ts',
      './tests/unit/**/*.test.ts',
      './tests/license/**/*.test.ts',
    ],
  },
})
