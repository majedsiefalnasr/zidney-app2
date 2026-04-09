import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/generate/__tests__/**/*.test.ts', 'scripts/**/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'coverage/**'],
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['json', 'text'],
      reportsDirectory: 'coverage',
      include: ['scripts/**'],
      exclude: ['**/node_modules/**', '**/dist/**', 'apps/**', 'packages/**/src/**'],
    },
  },
})
