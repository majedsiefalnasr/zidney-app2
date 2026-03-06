import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

/**
 * packages/api-client — Minimal Vitest Project Override
 *
 * Node environment, globals, and alias only.
 * Test discovery handled by root orchestrator.
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T005
 */
export default defineProject({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    name: 'api-client',
    globals: true,
    environment: 'node',
    include: ['./tests/**/*.test.ts'],
  },
})
