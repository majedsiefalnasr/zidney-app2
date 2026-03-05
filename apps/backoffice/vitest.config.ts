import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineProject } from 'vitest/config'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

/**
 * apps/backoffice — Minimal Vitest Project Override
 *
 * Environment, plugins, aliases, and env vars only.
 * Test discovery and coverage are handled by the root orchestrator.
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T003
 */
export default defineProject({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src') },
      {
        find: '@zidney/ui-system',
        replacement: resolve(
          __dirname,
          '../../packages/ui-system/src/index.ts'
        ),
      },
      {
        find: '@zidney/ui',
        replacement: resolve(__dirname, '../../packages/ui-system/src'),
      },
      {
        // Required: ui-system internal components use @shadcn-vue/ui/* imports
        find: '@shadcn-vue/ui',
        replacement: resolve(
          __dirname,
          '../../packages/ui-system/src/components/shadcn-vue'
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
        find: '@zidney/api-client',
        replacement: resolve(
          __dirname,
          '../../packages/api-client/src/index.ts'
        ),
      },
    ],
  },
  test: {
    name: 'backoffice',
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
