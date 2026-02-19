import { getIconCollections, iconsPlugin } from '@egoist/tailwindcss-icons'
import type { Config } from 'tailwindcss'

const config: Config = {
  // shadcn-vue content + ui-system components
  content: [
    './src/**/*.{vue,ts,tsx}',
    './index.html',
    // shadcn-vue components from node_modules
    './node_modules/@zidney/shadcn-vue/dist/**/*.{js,mjs,ts}',
  ],

  theme: {
    extend: {
      // White-label design tokens (workspace-overrideable)
      colors: {
        brand: {
          primary: 'var(--color-brand-primary, hsl(217.2 91.2% 59.8%))',
          secondary: 'var(--color-brand-secondary, hsl(221.2 83.2% 53.3%))',
          accent: 'var(--color-brand-accent, hsl(220.9 93.5% 56.1%))',
        },
        status: {
          error: 'var(--color-status-error, hsl(0 84.2% 60.2%))',
          success: 'var(--color-status-success, hsl(142.3 71.8% 29.3%))',
          warning: 'var(--color-status-warning, hsl(37.7 92.1% 50.2%))',
          info: 'var(--color-status-info, hsl(200.1 97.6% 48.4%))',
        },
      },
      spacing: {
        xs: 'var(--space-xs, 0.25rem)',
        sm: 'var(--space-sm, 0.5rem)',
        md: 'var(--space-md, 1rem)',
        lg: 'var(--space-lg, 1.5rem)',
        xl: 'var(--space-xl, 2rem)',
      },
      borderRadius: {
        sm: 'var(--radius-sm, 0.25rem)',
        md: 'var(--radius-md, 0.375rem)',
        lg: 'var(--radius-lg, 0.5rem)',
        full: 'var(--radius-full, 9999px)',
      },
    },
  },

  plugins: [
    iconsPlugin({
      collections: getIconCollections(['mdi', 'material-symbols']),
    }),
  ],

  // Ensure Tailwind v4 utilities are available
  corePlugins: {
    // Keep preflight for shadcn-vue base styles
    preflight: true,
  },
}

export default config
