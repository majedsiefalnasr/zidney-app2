import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['utils/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'coverage/**'],
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['json', 'text'],
      // write per-scope coverage into the scripts/coverage directory
      reportsDirectory: 'scripts/coverage',
      include: ['scripts/**'],
      exclude: ['**/node_modules/**', '**/dist/**', 'apps/**', 'packages/**/src/**'],
    },
  },
})
