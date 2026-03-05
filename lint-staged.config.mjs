/** @type {import('lint-staged').Config} */
export default {
  // TypeScript and Vue files: auto-fix lint errors, then format
  '*.{ts,tsx,vue}': ['eslint --fix', 'prettier --write'],

  // Markdown and JSON files: format only
  '*.{md,json}': ['prettier --write'],
}
