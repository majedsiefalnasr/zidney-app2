import path from 'path'
import { fileURLToPath } from 'url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { configDefaults, defineConfig } from 'vitest/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'hono',
        replacement: path.resolve(
          __dirname,
          'apps/api/node_modules/hono/dist/index.js'
        ),
      },
      {
        find: /^hono\/(.+)$/,
        replacement: path.resolve(
          __dirname,
          'apps/api/node_modules/hono/dist/$1.js'
        ),
      },
      {
        find: 'pg',
        replacement: path.resolve(
          __dirname,
          'apps/api/node_modules/pg/lib/index.js'
        ),
      },
      {
        find: 'bcrypt',
        replacement: path.resolve(
          __dirname,
          'apps/api/node_modules/bcrypt/bcrypt.js'
        ),
      },
      {
        find: 'redis',
        replacement: path.resolve(
          __dirname,
          'apps/api/node_modules/redis/dist/index.js'
        ),
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
        find: '@zidney/domain-core',
        replacement: path.resolve(
          __dirname,
          'packages/domain-core/src/index.ts'
        ),
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
        replacement: path.resolve(
          __dirname,
          'packages/validation/src/index.ts'
        ),
      },
      {
        find: '@zidney/redis-utils',
        replacement: path.resolve(
          __dirname,
          'packages/redis-utils/src/index.ts'
        ),
      },
      {
        find: '@zidney/config',
        replacement: path.resolve(__dirname, 'packages/config/src/index.ts'),
      },
    ],
  },
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/vitest.setup.ts'],
    exclude: [
      ...configDefaults.exclude,
      'packages/ui-system/tests/unit/DataTable.spec.ts',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'build/'],
    },
  },
})
