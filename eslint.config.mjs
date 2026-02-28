import eslint from '@eslint/js'
import importX from 'eslint-plugin-import-x'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',
    ],
  },

  // Base recommended configs
  eslint.configs.recommended,
  tseslint.configs.recommended,

  // Project-wide config
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },

    plugins: {
      'import-x': importX,
    },

    rules: {
      'no-console': 'warn',

      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': { descriptionFormat: '^: .+ \\[.+\\]$' },
          'ts-nocheck': false,
          'ts-check': false,
          'ts-expect-error': { descriptionFormat: '^: .+ \\[.+\\]$' },
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-require-imports': 'off',

      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: 'apps/api/**',
              from: 'apps/backoffice/**',
              message: 'API cannot import from Backoffice',
            },
            {
              target: 'apps/api/**',
              from: 'apps/frontoffice/**',
              message: 'API cannot import from Frontoffice',
            },
            {
              target: 'apps/api/**',
              from: 'apps/mmc/**',
              message: 'API cannot import from MMC',
            },
            {
              target: 'apps/api/**',
              from: 'apps/worker/**',
              message: 'API cannot import from Worker',
            },
            {
              target: 'apps/backoffice/**',
              from: 'apps/api/**',
              message: 'Backoffice cannot import from API',
            },
            {
              target: 'apps/frontoffice/**',
              from: 'apps/api/**',
              message: 'Frontoffice cannot import from API',
            },
            {
              target: 'apps/mmc/**',
              from: 'apps/api/**',
              message: 'MMC cannot import from API',
            },
            {
              target: 'apps/worker/**',
              from: 'apps/api/**',
              message: 'Worker cannot import from API',
            },
            {
              target: 'packages/**',
              from: 'apps/**',
              message: 'Packages cannot import from apps',
            },
          ],
        },
      ],
    },

    settings: {
      'import-x/resolver': {
        typescript: { alwaysTryTypes: true },
      },
    },
  }
)
