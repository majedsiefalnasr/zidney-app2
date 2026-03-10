# Specify Report — Hybrid Lint Format Pipeline

**Stage:** STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE
**Phase:** 01_PLATFORM_FOUNDATION
**Branch:** `spec/infra-010-hybrid-lint-format-pipeline`
**Step:** 1 — Specify
**Generated:** 2026-03-10T00:00:00.000Z
**Status:** ✅ Complete

---

## Summary

The specification has been written for the Hybrid Lint Format Pipeline stage. This is an infrastructure-only stage that introduces a deterministic, fast, AI-safe linting and formatting pipeline for the Zidney monorepo.

**Constitutional Impact:** None — no tenant isolation, license enforcement, attempt engine, or cross-tenant concerns.

---

## Specification Scope

### What Is Being Built

A unified tooling layer that:

- Assigns **Biome** as the primary linter/formatter for TS, JS, TSX, JSX, and Vue files
- Assigns **Prettier** (narrow scope) for Markdown only
- Assigns **yamllint** for YAML configuration files
- Assigns **actionlint** for GitHub Actions workflow validation
- Integrates with **Husky** + **lint-staged** for sub-second pre-commit performance
- Provides a **pre-push pipeline** for full validation (Biome + architecture guard + infra audit)

### Functional Requirements

| ID    | Requirement                                             |
| ----- | ------------------------------------------------------- |
| FR-01 | Biome is primary linter/formatter for TS/JS/TSX/JSX/Vue |
| FR-02 | Prettier scoped exclusively to `*.md` files             |
| FR-03 | yamllint validates `*.yml` and `*.yaml` files           |
| FR-04 | actionlint validates `.github/workflows/*.yml`          |
| FR-05 | Husky pre-commit delegates to `bunx lint-staged`        |
| FR-06 | lint-staged config has non-overlapping file matchers    |
| FR-07 | Pre-push hook runs full Biome + ai-guard + infra-audit  |
| FR-08 | Pipeline covers `apps/*`, `packages/*`, `scripts/*`     |
| FR-09 | No ESLint rules that duplicate Biome                    |
| FR-10 | All commands compatible with Bun execution              |

### Non-Functional Requirements

| ID     | Requirement                              | Target            |
| ------ | ---------------------------------------- | ----------------- |
| NFR-01 | Pre-commit incremental performance       | 50–150 ms         |
| NFR-02 | Full repository scan performance         | < 0.5–3 seconds   |
| NFR-03 | Deterministic output across environments | Zero config drift |
| NFR-04 | AI-generated code must pass all checks   | 100% compliance   |
| NFR-05 | Tool isolation (no overlap)              | Zero duplication  |
| NFR-06 | Failure transparency                     | Clear exit codes  |

### Out of Scope

- CI pipeline job definitions
- Per-package biome.json overrides
- Lint rule governance (already owned by STAGE_INFRA_05)
- TypeScript migration of existing files
- Code auto-fix during push

---

## Dependencies Identified

| Dependency  | Type    | Purpose                            |
| ----------- | ------- | ---------------------------------- |
| biome       | npm     | Primary linter/formatter           |
| prettier    | npm     | Markdown formatting                |
| lint-staged | npm     | Staged-file-only pre-commit runner |
| husky       | npm     | Git hook management                |
| yamllint    | system  | YAML validation                    |
| actionlint  | system  | GitHub Actions syntax validation   |
| bun         | runtime | All script execution               |

---

## Clarification Markers

None — all requirements are clearly defined in the stage file. No `[NEEDS CLARIFICATION]` markers were introduced.

---

## Checklist Status

`specs/runtime/infra-010-hybrid-lint-format-pipeline/checklists/requirements.md` — all items pass ✅

**Readiness verdict:** Ready for Clarify step.
