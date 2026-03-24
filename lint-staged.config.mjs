/** @type {import('lint-staged').Config} */
export default {
  // Prettier: Markdown ONLY — TS/JS/Vue/JSON handled exclusively by Biome.
  '*.md': ['prettier --write'],

  // SKILL.md validation: Enforce <500 line limit (Q4 requirement)
  '**/SKILL.md': ['bash scripts/ci/validate-skill-sizes.sh'],

  // Biome: handles all code and config files (excluding auto-generated artifacts).
  '*.{ts,tsx,js,jsx,mjs,vue,json}': [
    (files) => {
      const filtered = files.filter((f) => !f.includes('docs/ai/context/gitnexus-context.json'))
      return filtered.length > 0 ? `bun biome check --write ${filtered.join(' ')}` : ''
    },
  ],

  // yamllint: validates YAML syntax and style. Graceful skip if not installed.
  // Workflow files (*.yml under .github/) also match this pattern and run yamllint
  // first, then actionlint below — intentional dual-layer validation.
  '*.{yml,yaml}': ['bash scripts/ci/yaml_lint.sh'],

  // actionlint: validates GitHub Actions workflow syntax (runs on top of yaml-lint above).
  // Guard so commits don't fail on machines without actionlint installed.
  '.github/workflows/*.yml': ['bash scripts/ci/actionlint_wrapper.sh'],
}
