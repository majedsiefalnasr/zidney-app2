# Plan Report — STAGE_INFRA_04_BIOME

**Step:** 3 — Plan **Stage:** STAGE_INFRA_04_BIOME **Phase:** 01_PLATFORM_FOUNDATION **Branch:**
spec/infra-004-biome **Generated:** 2026-03-06T00:00:00.000Z

---

## Summary

Technical plan complete for Biome unified linting and formatting engine. Guardian validations
passed.

**Outcome:** PASS — plan.md and research.md written, both guardians returned VERDICT: PASS, task
generation authorized.

---

## Guardian Verdict Summary

| Guardian                    | Verdict |
| --------------------------- | ------- |
| Zidney Architecture Checker | ✅ PASS |
| Zidney API Designer         | ✅ PASS |

**Architecture Checker key findings:**

- No architectural layer rule violations
- No trust chain violation
- No forbidden dependencies
- No ARCHITECTURE_MAP.json changes required
- No ADR violations
- Defense-in-depth note: ESLint per-app import restrictions removed (AI-Guard remains as single
  enforcement layer — acceptable)
- `apps/worker/src/observability/structured-logger.ts` must be evaluated in Pass 2 for logger-bridge
  override vs. migration

**API Designer key findings:**

- No API contracts changed
- Error response format preserved
- All 5 auth middleware files: logging swap only
- `noConsole: "error"` rule strengthens AGENTS.md logging discipline
- Group A (mandatory replacement) vs Group B (suppression acceptable) separation is architecturally
  sound

---

## Plan Architecture

### 3-Pass Migration Structure

| Pass   | Description                                                                         | Committable |
| ------ | ----------------------------------------------------------------------------------- | ----------- |
| Pass 1 | Install Biome + write `biome.json`                                                  | ✅ Yes      |
| Pass 2 | Resolve all violations (console migration, format passes, auto-fix)                 | ✅ Yes      |
| Pass 3 | Remove legacy toolchain, update CI, update lint-staged, update package.json scripts | ✅ Yes      |

### Key Implementation Decisions

| Decision                                         | Rationale                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Single root `biome.json`                         | Eliminates config drift; no per-package override                        |
| `noConsole: "off"` for `packages/logger/**`      | Logger wraps `console.*` internally — legitimate                        |
| `noConsole: "off"` for `scripts/**` + test files | CLI and test output — acceptable                                        |
| Biome installed without version pin              | Registry resolves latest; version captured in `$schema` URL             |
| `lint-staged` → `bun biome check --apply-unsafe` | Replaces ESLint/Prettier entries                                        |
| CI gates in `ci.yml` ONLY                        | Governance workflows untouched (clarification CL-01)                    |
| Line width 100                                   | Intentional change; large initial reformat diff expected and documented |

### `biome.json` Core Configuration

```json
{
  "$schema": "https://biomejs.dev/schemas/X.Y.Z/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noDebugger": "error", "noConsole": "error" },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "style": { "useConst": "error", "noVar": "error" }
    }
  },
  "overrides": [
    {
      "include": ["packages/logger/**/*.ts"],
      "linter": { "rules": { "suspicious": { "noConsole": "off" } } }
    },
    {
      "include": ["scripts/**", "*.config.*"],
      "linter": { "rules": { "suspicious": { "noConsole": "off" } } }
    },
    {
      "include": ["**/*.test.ts", "**/*.spec.ts"],
      "linter": { "rules": { "suspicious": { "noConsole": "off" } } }
    }
  ],
  "files": { "ignore": ["node_modules", "dist", "build", ".turbo", "coverage"] }
}
```

### Packages to Remove (8 ESLint + 1 Prettier)

`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-vue`, `@vue/eslint-config-typescript`,
`eslint-plugin-playwright`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`,
`prettier`

### Config Files to Delete

`eslint.config.mjs`, `apps/backoffice/eslint.config.js`, `apps/frontoffice/eslint.config.js`,
`apps/mmc/eslint.config.js`, `prettier.config.mjs`, `.prettierrc`

### CI Update (`ci.yml` lint job)

Replace ESLint step with:

```yaml
- name: Lint (Biome)
  run: bun biome check .
- name: Format Check (Biome)
  run: bun biome format --check .
```

---

## Research Findings Summary

| Finding                                | Key Output                                                |
| -------------------------------------- | --------------------------------------------------------- |
| ESLint packages in root `package.json` | 8 packages to remove                                      |
| Prettier packages                      | 1 package + 2 config files                                |
| Per-app ESLint configs                 | 4 files to delete                                         |
| lint-staged current state              | Uses `eslint --fix` + `prettier --write` → replace both   |
| CI workflow structure                  | `ci.yml` lint job has `bun run lint` → replace with Biome |
| console.\* violations                  | ~75 source files in Group A (mandatory replacement)       |
| Migration runner files                 | ~12 files in Group B (suppression acceptable)             |
| Biome latest version                   | 2.4.6 confirmed                                           |
| tsconfig/build impact                  | None — confirmed                                          |
| Vue file support                       | Script blocks only (template syntax not analyzed)         |

---

## Artifacts Produced

| File                                      | Owner   | Status                 |
| ----------------------------------------- | ------- | ---------------------- |
| specs/runtime/infra-004-biome/plan.md     | SpecKit | ✅ Created (704 lines) |
| specs/runtime/infra-004-biome/research.md | SpecKit | ✅ Created (353 lines) |

---

**Next Step:** Proceed to Step 4 (Tasks) — no blockers detected.
