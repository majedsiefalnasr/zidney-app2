import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineProject } from 'vitest/config'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

/**
 * apps/mmc — Minimal Vitest Project Override
 *
 * Environment, plugins, aliases, and env vars only.
 * Test discovery and coverage are handled by the root orchestrator.
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T002
 */
export default defineProject({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src') },
      {
        find: '@zidney/logger',
        replacement: resolve(__dirname, '../../packages/logger/src/index.ts'),
      },
      {
        find: '@zidney/api-client',
        replacement: resolve(
          __dirname,
          '../../packages/api-client/src/index.ts'
        ),
      },
      {
        find: '@zidney/types',
        replacement: resolve(__dirname, '../../packages/types/src/index.ts'),
      },
    ],
  },
  test: {
    name: 'mmc',
    globals: true,
    environment: 'jsdom',
    include: [
      './tests/unit/**/*.test.ts',
      './tests/integration/**/*.test.ts',
      './src/**/__tests__/**/*.spec.ts',
    ],
    env: {
      VITE_API_BASE_URL: 'http://test.local',
      VITE_WORKSPACE_SLUG: 'test',
    },
  },
})
