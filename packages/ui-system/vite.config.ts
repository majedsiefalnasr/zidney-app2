import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],

  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'ZidneyUISystem',
      formats: ['es', 'cjs'],
      fileName: (format) => `ui-system.${format === 'es' ? 'mjs' : 'cjs'}`,
    },

    rollupOptions: {
      external: ['vue', 'tailwindcss'],
      output: {
        globals: {
          vue: 'Vue',
          tailwindcss: 'Tailwind',
        },
      },
    },

    minify: 'terser',
    sourcemap: true,
    emptyOutDir: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './src'),
      '@zidney/shadcn-vue/ui': path.resolve(
        __dirname,
        './src/components/shadcn-vue'
      ),
    },
  },

  css: {
    postcss: './postcss.config.js',
  },
})
