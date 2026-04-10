import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/generate/__tests__/**/*.test.ts', 'scripts/utils/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['json'],
      all: true,
      include: ['scripts/**/*.ts'],
      exclude: [],
    },
  },
})
