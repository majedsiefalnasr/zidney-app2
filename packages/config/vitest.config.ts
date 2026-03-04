import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineProject } from 'vitest/config'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

/**
 * packages/config — Minimal Vitest Project Override
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T010
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
    name: 'config',
    globals: true,
    environment: 'node',
    include: ['./tests/unit/**/*.spec.ts', './tests/unit/**/*.test.ts'],
  },
})
