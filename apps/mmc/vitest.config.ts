import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')
const appRoot = resolve(__dirname)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [{ find: '@', replacement: resolve(__dirname, 'src') }],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [`${appRoot}/tests/unit/**/*.test.ts`],
    env: {
      VITE_API_BASE_URL: 'http://test.local',
      VITE_WORKSPACE_SLUG: 'test',
    },
  },
})
