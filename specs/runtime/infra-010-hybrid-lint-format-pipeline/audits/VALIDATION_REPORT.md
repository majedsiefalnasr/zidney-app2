# Validation Report

**Stage:** STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE **Step:** 6 — Implement **Generated:**
2026-03-10T02:00:00.000Z

---

## Summary

| Check                                     | Result     | Notes                                                    |
| ----------------------------------------- | ---------- | -------------------------------------------------------- |
| Unit tests (lint-staged config)           | ✅ PASS    | 21 tests, 0 failed                                       |
| Biome lint — stage-scope files            | ✅ PASS    | Exit 0; 0 errors, 0 warnings in our files                |
| Biome lint — full monorepo                | ⚠️ WARNING | Exit 1 — 13 pre-existing errors in unrelated files       |
| TypeScript type-check — stage files       | ✅ PASS    | Exit 0; 0 errors in our files                            |
| TypeScript type-check — full monorepo     | ⚠️ WARNING | Pre-existing type errors in unrelated test files         |
| Prettier format check (`format:check:md`) | ✅ PASS    | Exit 0 — all matched .md files use Prettier code style   |
| Pre-commit hook (lint-staged)             | ✅ PASS    | All hooks passed on implementation commit (SHA: d9b9d2e) |
| Architecture governance (infra-audit)     | ✅ PASS    | Score 100/100; 0 layer violations; 0 arch drift          |

---

## Unit Tests

**Command:** `bun run test tests/unit/lint-staged/lint-staged-config.test.ts`

**Result:** 21 passed, 0 failed (237 ms)

```
✓ T1: Biome entry (1)
✓ T2: Prettier entry (1)
✓ T3: yamllint entry (1)
✓ T4: actionlint entry (1)
✓ T5: TS/JS keys do not invoke prettier (8)
✓ T6: *.md key does not invoke biome (1)
✓ T7: *.{yml,yaml} key does not invoke prettier (1)
✓ T8: Config shape (1)
✓ T9: .prettierrc config drift (2)
✓ T10: .prettierignore does not exclude *.md (1)
✓ T11: .yamllint config drift (3)
```

---

## Lint — Stage-Scope Files

**Command:** `bun biome check lint-staged.config.mjs package.json tests/unit/lint-staged/`

**Result:** Exit 0 — `Checked 3 files in 4ms. No fixes applied.`

---

## Lint — Full Monorepo

**Command:** `bun run lint`

**Result:** Exit 1 — 13 errors, 3760 warnings in pre-existing files

**Assessment:** ALL 13 errors are in pre-existing `apps/api/src/` files not modified by this stage.
Zero new errors introduced by this stage.

Affected files (pre-existing, out of scope):

- `apps/api/src/handlers/licenses/create-license.ts`
- `apps/api/src/handlers/licenses/get-license-status.ts`
- Various `apps/api/src/middleware/` files

These errors existed before this branch was created and are tracked separately.

---

## TypeScript Type-Check — Stage-Scope Files

**Command:** `bun tsc --noEmit --project tsconfig.test.json 2>&1 | grep 'lint-staged'`

**Result:** No output — zero errors in `tests/unit/lint-staged/lint-staged-config.test.ts`

---

## TypeScript Type-Check — Full Monorepo

**Command:** `bun run typecheck`

**Result:** Pre-existing type errors in:

- `tests/unit/workspace-settings-validation.test.ts`
- `tests/validation/artifact-schema-validation.test.ts`

**Assessment:** Neither file was modified by this stage. Zero regressions introduced.

---

## Prettier Format Check

**Command:** `bun run format:check:md`

**Result:** Exit 0 — `All matched files use Prettier code style!`

**Note:** 955 project `.md` files were auto-formatted in T008 to establish the formatting baseline.
The `.agents/` and `.specify/` AI tooling directories are excluded via `.prettierignore`.

---

## Pre-Commit Hook

**Commit SHA:** d9b9d2e

**Hook output:**

```
Formatting staged files with Biome… Formatted 3 files in 12ms. No fixes applied.
✔ Backed up original state in git stash
✔ Running tasks for staged files...
✔ Applying modifications from tasks...
✔ Cleaning up temporary files...
```

All hooks passed. 968 files committed.

---

## Architecture Governance

**Tool:** `scripts/infra-audit.ts`

**Result:**

```
Architecture score: 100 / 100
Architecture trend since last audit: 0 regression
Dependency violations: 0
Circular dependencies: 0
Layer violations: 0
Architecture map violations: 0
Architecture drift: 0
```

---

## Conclusion

All stage-scope validation checks pass. Pre-existing failures in unrelated files are documented
above and are out of scope for this stage. Implementation is complete and the stage is ready for
closure.
