/** @type {import('lint-staged').Config} */
export default {
  // Prettier: Markdown ONLY — TS/JS/Vue/JSON handled exclusively by Biome.
  '*.md': ['prettier --write'],

  // Biome: handles all code and config files.
  '*.{ts,tsx,js,jsx,mjs,vue,json}': ['bun biome check --write'],

  // yamllint: validates YAML syntax and style. Graceful skip if not installed.
  // Workflow files (*.yml under .github/) also match this pattern and run yamllint
  // first, then actionlint below — intentional dual-layer validation.
  '*.{yml,yaml}': [
    'bash -c "command -v yamllint > /dev/null 2>&1 && yamllint \\"$@\\" || (echo \\"⚠️  yamllint not installed — skipping. Install: brew install yamllint\\" && exit 0)" --',
  ],

  // actionlint: validates GitHub Actions workflow syntax (runs on top of yamllint above).
  '.github/workflows/*.yml': ['actionlint'],
}
