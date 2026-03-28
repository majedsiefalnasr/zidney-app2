import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineProject, defineWorkspace } from 'vitest/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Vitest Workspace — Projects Orchestrator
 *
 * Defines all test projects across apps and packages.
 * Root tests/ directory is included as an inline project so that
 * API/worker integration tests and root-level unit/security tests
 * continue to run via the root resolver (see vitest.config.ts).
 *
 * Per-app and per-package configs are minimal overrides that declare:
 * - environment (node | jsdom)
 * - plugins (Vue SFC parser where needed)
 * - setupFiles
 * - env vars
 * - resolve aliases
 *
 * Stage: STAGE_INFRA_03_ALIGNMENT — T001
 */
export default defineWorkspace([
  // Root tests project — API/worker integration tests, security tests, unit tests
  // Needs full resolve.alias for hono, pg, bcrypt, redis, etc.
  defineProject({
    plugins: [tsconfigPaths()],
    resolve: {
      alias: [
        {
          find: 'hono',
          replacement: path.resolve(__dirname, 'apps/api/node_modules/hono/dist/index.js'),
        },
        {
          find: /^hono\/(.+)$/,
          replacement: path.resolve(__dirname, 'apps/api/node_modules/hono/dist/$1.js'),
        },
        {
          find: 'pg',
          replacement: path.resolve(__dirname, 'apps/api/node_modules/pg/lib/index.js'),
        },
        {
          find: 'bcrypt',
          replacement: path.resolve(__dirname, 'apps/api/node_modules/bcrypt/bcrypt.js'),
        },
        {
          find: 'redis',
          replacement: path.resolve(__dirname, 'apps/api/node_modules/redis/dist/index.js'),
        },
        {
          find: 'jsonwebtoken',
          replacement: path.resolve(__dirname, 'tests/shims/jsonwebtoken.ts'),
        },
        {
          find: 'zod',
          replacement: path.resolve(
            __dirname,
            'node_modules/.bun/zod@3.25.76/node_modules/zod/index.js'
          ),
        },
        {
          find: 'pinia',
          replacement: path.resolve(__dirname, 'apps/mmc/node_modules/pinia/dist/pinia.mjs'),
        },
        {
          find: 'vue-router',
          replacement: path.resolve(
            __dirname,
            'apps/mmc/node_modules/vue-router/dist/vue-router.mjs'
          ),
        },
        {
          find: 'vue',
          replacement: path.resolve(
            __dirname,
            'apps/mmc/node_modules/vue/dist/vue.runtime.esm-bundler.js'
          ),
        },
        {
          find: /^@zidney\/app\/([^/]+)\/(.*)$/,
          replacement: path.resolve(__dirname, 'apps/$1/src/$2'),
        },
        {
          find: /^@zidney\/package\/([^/]+)\/(.*)$/,
          replacement: path.resolve(__dirname, 'packages/$1/src/$2'),
        },
        {
          find: /^@zidney\/domain-core\/(.*)$/,
          replacement: path.resolve(__dirname, 'packages/domain-core/src/$1'),
        },
        {
          find: /^@zidney\/logger\/(.*)$/,
          replacement: path.resolve(__dirname, 'packages/logger/src/$1'),
        },
        {
          find: /^@zidney\/types\/(.*)$/,
          replacement: path.resolve(__dirname, 'packages/types/src/$1'),
        },
        {
          find: /^@zidney\/validation\/(.*)$/,
          replacement: path.resolve(__dirname, 'packages/validation/src/$1'),
        },
        {
          find: /^@zidney\/redis-utils\/(.*)$/,
          replacement: path.resolve(__dirname, 'packages/redis-utils/src/$1'),
        },
        {
          find: /^@zidney\/config\/(.*)$/,
          replacement: path.resolve(__dirname, 'packages/config/src/$1'),
        },
        {
          find: '@zidney/api-client',
          replacement: path.resolve(__dirname, 'packages/api-client/src/index.ts'),
        },
        {
          find: '@zidney/domain-core',
          replacement: path.resolve(__dirname, 'packages/domain-core/src/index.ts'),
        },
        {
          find: '@zidney/logger',
          replacement: path.resolve(__dirname, 'packages/logger/src/index.ts'),
        },
        {
          find: '@zidney/types',
          replacement: path.resolve(__dirname, 'packages/types/src/index.ts'),
        },
        {
          find: '@zidney/validation',
          replacement: path.resolve(__dirname, 'packages/validation/src/index.ts'),
        },
        {
          find: '@zidney/redis-utils',
          replacement: path.resolve(__dirname, 'packages/redis-utils/src/index.ts'),
        },
        {
          find: '@zidney/config',
          replacement: path.resolve(__dirname, 'packages/config/src/index.ts'),
        },
      ],
    },
    test: {
      name: 'root',
      globals: true,
      environment: 'node',
      setupFiles: ['./tests/vitest.setup.ts'],
      include: ['./tests/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', './tests/e2e/**', '**/tests/e2e/**'],
    },
  }),

  // Vue 3 SPA apps (jsdom environment)
  'apps/mmc/vitest.config.ts',
  'apps/backoffice/vitest.config.ts',
  'apps/frontoffice/vitest.config.ts',

  // Backend apps (node environment)
  'apps/api/vitest.config.ts',
  'apps/worker/vitest.config.ts',

  // AI Engine orchestration scripts
  defineProject({
    plugins: [tsconfigPaths()],
    resolve: {
      alias: [
        {
          find: '@zidney/logger',
          replacement: path.resolve(__dirname, 'packages/logger/src/index.ts'),
        },
      ],
    },
    test: {
      name: 'ai-engine',
      globals: true,
      environment: 'node',
      include: ['scripts/ai-engine/__tests__/**/*.test.ts'],
    },
  }),

  // Repository hygiene checks
  defineProject({
    plugins: [tsconfigPaths()],
    test: {
      name: 'hygiene-checks',
      globals: true,
      environment: 'node',
      include: ['scripts/dev/hygiene-checks/__tests__/**/*.test.ts'],
    },
  }),

  // Shared packages
  'packages/api-client/vitest.config.ts',
  'packages/domain-core/vitest.config.ts',
  'packages/logger/vitest.config.ts',
  'packages/config/vitest.config.ts',
  'packages/redis-utils/vitest.config.ts',
  'packages/types/vitest.config.ts',
  'packages/ui-system/vitest.config.ts',
  'packages/validation/vitest.config.ts',

  // Validate scripts (runtime script CI guard)
  defineProject({
    plugins: [tsconfigPaths()],
    test: {
      name: 'validate-scripts',
      globals: true,
      environment: 'node',
      include: ['scripts/validate/__tests__/**/*.test.ts'],
    },
  }),

  // Context scripts (arch:context:build / arch:context:validate / etc.)
  defineProject({
    plugins: [tsconfigPaths()],
    test: {
      name: 'context-scripts',
      globals: true,
      environment: 'node',
      include: ['scripts/context/__tests__/**/*.test.ts'],
    },
  }),

  // Package docs generator tests
  defineProject({
    plugins: [tsconfigPaths()],
    test: {
      name: 'generate-scripts',
      globals: true,
      environment: 'node',
      include: ['scripts/generate/__tests__/**/*.test.ts'],
    },
  }),
])
