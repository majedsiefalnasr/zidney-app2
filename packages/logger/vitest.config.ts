import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

/**
 * packages/logger — Minimal Vitest Project Override
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T009
 */
export default defineProject({
  resolve: {
    alias: [
      {
        find: '@zidney/types',
        replacement: resolve(__dirname, '../types/src/index.ts'),
      },
    ],
  },
  test: {
    name: 'logger',
    globals: true,
    environment: 'node',
    include: ['./tests/unit/**/*.spec.ts', './tests/unit/**/*.test.ts'],
  },
})
