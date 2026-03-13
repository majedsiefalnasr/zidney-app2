/** @type {import('lint-staged').Config} */
export default {
  // Prettier: Markdown ONLY — TS/JS/Vue/JSON handled exclusively by Biome.
  '*.md': ['prettier --write'],

  // Biome: handles all code and config files.
  '*.{ts,tsx,js,jsx,mjs,vue,json}': ['bun biome check --write'],

  // yamllint: validates YAML syntax and style. Graceful skip if not installed.
  // Workflow files (*.yml under .github/) also match this pattern and run yamllint
  // first, then actionlint below — intentional dual-layer validation.
  '*.{yml,yaml}': ['bash scripts/ci/yaml_lint.sh'],

  // actionlint: validates GitHub Actions workflow syntax (runs on top of yaml-lint above).
  // Guard so commits don't fail on machines without actionlint installed.
  '.github/workflows/*.yml': ['bash scripts/ci/actionlint_wrapper.sh'],
}
