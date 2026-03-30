/** @type {import('lint-staged').Config} */
export default {
  // Prettier: Markdown ONLY — TS/JS/Vue/JSON handled exclusively by Biome.
  '*.md': ['prettier --write'],

  // SKILL.md validation: Enforce <500 line limit (Q4 requirement)
  '**/SKILL.md': ['bash scripts/ci/validate-skill-sizes.sh'],

  // Biome: handles all code and config files.
  '*.{ts,tsx,js,jsx,mjs,vue,json}': ['bun biome check --write'],

  // Prettier: YAML formatting
  '*.{yml,yaml}': ['prettier --write'],

  // actionlint: validates GitHub Actions workflow syntax.
  // Guard so commits don't fail on machines without actionlint installed.
  '.github/workflows/*.yml': ['bash scripts/ci/actionlint_wrapper.sh'],
}
