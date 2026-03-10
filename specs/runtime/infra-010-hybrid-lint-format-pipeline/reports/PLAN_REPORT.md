# Plan Report — Hybrid Lint Format Pipeline

**Stage:** STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE
**Phase:** 01_PLATFORM_FOUNDATION
**Branch:** `spec/infra-010-hybrid-lint-format-pipeline`
**Step:** 3 — Plan
**Generated:** 2026-03-10T00:00:00.000Z
**Guardian Verdict:** ✅ PASS (Architecture Checker) | ✅ PASS (API Designer — N/A, infra-only stage)

---

## Technical Design Summary

### What This Stage Does

An **additive-only** infrastructure update that extends the existing lint/format pipeline to cover Markdown, YAML, and GitHub Actions workflow files. No existing functionality is removed or replaced.

### Files Created (4)

| File                                                | Purpose                                        |
| --------------------------------------------------- | ---------------------------------------------- |
| `.prettierrc`                                       | Markdown-only Prettier config (printWidth=100) |
| `.prettierignore`                                   | Blocks Prettier from Biome-managed files       |
| `.yamllint`                                         | YAML lint config (extends default, 120ch)      |
| `tests/unit/lint-staged/lint-staged-config.test.ts` | 8 structural unit tests for lint-staged config |

### Files Modified (3)

| File                     | Change                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `lint-staged.config.mjs` | Add `*.md` → prettier, `*.{yml,yaml}` → yamllint, `.github/workflows/*.yml` → actionlint       |
| `package.json`           | Add `prettier@^3` devDep; add `format:check:md`, `validate:yaml`, `validate:workflows` scripts |
| `.husky/pre-push`        | Add `actionlint .github/workflows/` after infra-audit                                          |

### Files NOT Modified

| File                | Reason                                                               |
| ------------------- | -------------------------------------------------------------------- |
| `biome.json`        | Already correctly configured for v2.4.6                              |
| `.husky/pre-commit` | Already calls `bunx lint-staged`; picks up new entries automatically |

---

## Key Design Decisions

### 1. lint-staged.config.mjs Location

Canonical ESM config file, not inline in `package.json`. Already in use.

### 2. Single `bun biome check --write` Command

Covers format + lint + import organization atomically. Two-command form leaves auto-fixable lint unremediated.

### 3. prettier Scoped to `*.md` Only

`.prettierignore` enforces the no-overlap rule — Biome manages all code files. A comment in the config declares: `// Prettier: md ONLY - TS/JS/Vue handled exclusively by Biome.`

### 4. actionlint Graceful Fallback

Pre-push hook uses `command -v actionlint || { echo "⚠️  actionlint not installed..."; exit 0; }` to avoid blocking pushes on machines without actionlint. Installation documented in TESTING_GUIDE.

### 5. yamllint as System Tool

Not an npm package. Requires `brew install yamllint` or OS equivalent. Graceful skip on missing binary.

---

## Guard Findings

### Architecture Checker

| Risk      | Finding                               | Mitigation (in Implementation)     |
| --------- | ------------------------------------- | ---------------------------------- |
| 🟡 Medium | actionlint implicit system dependency | Graceful skip fallback in pre-push |
| 🟡 Medium | Prettier scope overlap risk (future)  | Comment in lint-staged.config.mjs  |

### API Designer

N/A — This is an infrastructure-only stage. No API endpoints, routes, or HTTP contracts are involved.

---

## Testing Strategy

| Test Type   | File                                                | Coverage                                            |
| ----------- | --------------------------------------------------- | --------------------------------------------------- |
| Unit        | `tests/unit/lint-staged/lint-staged-config.test.ts` | Config structure, glob correctness, no-overlap rule |
| Integration | Pre-commit hook smoke test (manual)                 | Staged file processing per file type                |
| Performance | Commit with single TS file (manual)                 | Verify < 200ms                                      |

---

## Risk Assessment

**Risk Level: LOW**

- All changes are additive
- No existing hooks, scripts, or configs removed
- No runtime impact (tooling only)
- Biome config unchanged
- System tool dependencies (yamllint, actionlint) gracefully handled

---

## Pre-Conditions for Implementation

- [x] prettier not currently in devDependencies → will be added via `bun add -D prettier`
- [x] No .prettierrc exists → will be created
- [x] No .yamllint exists → will be created
- [x] Architecture Checker: PASS
- [x] All clarifications resolved

---

## Plan Status

✅ Ready for Task generation.
