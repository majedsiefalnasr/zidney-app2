import tsParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      // Disallow direct fetch()/axios imports outside core/api/client.ts
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['axios', 'axios/*'],
              message:
                'Use @/core/api/client.ts getApiClient() instead of importing axios directly.',
            },
          ],
        },
      ],
      // Disallow cross-app imports from mmc or frontoffice
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src',
              from: '../../mmc/src',
              message:
                'Backoffice must not import from apps/mmc. Cross-app imports are forbidden.',
            },
            {
              target: './src',
              from: '../../frontoffice/src',
              message:
                'Backoffice must not import from apps/frontoffice. Cross-app imports are forbidden.',
            },
            {
              // Disallow import.meta.env references outside env.ts
              target: './src/!(core/config/env.ts)**',
              from: './src',
              message:
                'Direct import.meta.env access is forbidden outside src/core/config/env.ts. Use appConfig instead.',
            },
          ],
        },
      ],
    },
  },
  // Enforce import.meta.env prohibition via AST selector (D2)
  {
    files: ['**/*.ts', '**/*.vue'],
    ignores: ['src/core/config/env.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.type='MetaProperty'][object.meta.name='import'][object.property.name='meta'][property.name='env']",
          message:
            'Direct import.meta.env access is forbidden. Use appConfig from @/core/config/app-config instead.',
        },
      ],
    },
  },
])
