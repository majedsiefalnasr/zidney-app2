import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import importX from 'eslint-plugin-import-x'
import eslintPluginVue from 'eslint-plugin-vue'
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
  },

  // T066/T067: Ban direct HTTP clients in app code — use @zidney/api-client
  {
    files: [
      'apps/mmc/src/**/*.{ts,vue}',
      'apps/backoffice/src/**/*.{ts,vue}',
      'apps/frontoffice/src/**/*.{ts,vue}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'axios', message: 'Use @zidney/api-client instead.' },
            { name: 'got', message: 'Use @zidney/api-client instead.' },
            { name: 'ky', message: 'Use @zidney/api-client instead.' },
            { name: 'node-fetch', message: 'Use @zidney/api-client instead.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Use @zidney/api-client instead of raw fetch. If you need fetch for auth refresh, import it from core/api/client.',
        },
      ],
    },
  },

  // T025 (STAGE_UI_09): XSS Mitigation — Enforce vue/no-v-html as 'error' (FR-SEC-17)
  // Advisory 'warn' is constitutionally insufficient per AGENTS.md security posture.
  // Audit confirmed zero existing v-html usages in apps/mmc, apps/backoffice, apps/frontoffice.
  // vue-eslint-parser is provided by eslint-plugin-vue flat/base config.
  // TypeScript parser is explicitly set for <script lang="ts"> blocks.
  ...eslintPluginVue.configs['flat/base'].map((config) => ({
    ...config,
    files: [
      'apps/mmc/src/**/*.vue',
      'apps/backoffice/src/**/*.vue',
      'apps/frontoffice/src/**/*.vue',
    ],
  })),
  {
    files: [
      'apps/mmc/src/**/*.vue',
      'apps/backoffice/src/**/*.vue',
      'apps/frontoffice/src/**/*.vue',
    ],
    languageOptions: {
      parserOptions: {
        // Use @typescript-eslint/parser to process <script lang="ts"> blocks
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'vue/no-v-html': 'error',
    },
  },

  // T005 (STAGE_UI_06): API client import firewall — covers .vue AND .ts (composables, helpers)
  // Store files are excluded; they are the only layer allowed to call the API client (FR-008, SC-002)
  // core/api and core/auth are excluded — they are the infrastructure wrappers below the store layer
  {
    files: ['apps/**/*.{vue,ts}'],
    ignores: [
      'apps/*/src/core/state/**',
      'apps/*/src/modules/**/*.store.ts',
      'apps/*/src/core/api/**',
      'apps/*/src/core/auth/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@zidney/api-client', '@zidney/api-client/*'],
              message:
                'Direct API client imports are forbidden. ' +
                'Call a store action instead. (STAGE_UI_06 — FR-008)',
            },
          ],
        },
      ],
    },
  },

  // T005 (STAGE_UI_06): Prevent v-html in all app templates — broader catch for XSS
  // via notification/workspace name rendering (FR-027)
  {
    files: ['apps/**/*.vue'],
    rules: {
      'vue/no-v-html': 'error',
    },
  },

  // eslint-config-prettier: Disable all ESLint rules that conflict with Prettier.
  // This MUST be the last entry in the config array.
  // Stage: STAGE_INFRA_03_ALIGNMENT — T042
  eslintConfigPrettier
)
