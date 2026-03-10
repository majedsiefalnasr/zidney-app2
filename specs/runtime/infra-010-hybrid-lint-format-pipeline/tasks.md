# Tasks: Hybrid Lint Format Pipeline

**Phase:** 01_PLATFORM_FOUNDATION
**Stage:** STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE
**Related Plan:** specs/runtime/infra-010-hybrid-lint-format-pipeline/plan.md
**Related Spec:** specs/runtime/infra-010-hybrid-lint-format-pipeline/spec.md
**Branch:** `spec/infra-010-hybrid-lint-format-pipeline`
**Date:** 2026-03-10

---

## Stage Context

| Field        | Value                                                               |
| ------------ | ------------------------------------------------------------------- |
| Phase        | 01_PLATFORM_FOUNDATION                                              |
| Stage        | STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE                          |
| Related Plan | specs/runtime/infra-010-hybrid-lint-format-pipeline/plan.md         |
| Related Spec | specs/runtime/infra-010-hybrid-lint-format-pipeline/spec.md         |
| Related ADR  | None — no ADR governs lint tooling selection                        |

---

## Implementation Overview

This stage is **purely additive**. No existing configuration is removed or broken. All changes fall into three buckets:

1. **New files:** `.prettierrc`, `.prettierignore`, `.yamllint`
2. **File modifications:** `lint-staged.config.mjs`, `.husky/pre-push`, `package.json`
3. **New test file:** `tests/unit/lint-staged/lint-staged-config.test.ts`

**Files confirmed NOT modified by this stage:**

| File                              | Reason                                                            |
| --------------------------------- | ----------------------------------------------------------------- |
| `biome.json`                      | Already correctly configured — do not touch                       |
| `.husky/pre-commit`               | Already invokes `bunx lint-staged` — no change needed             |
| All `apps/*` / `packages/*` files | No source code changes in this infrastructure-only stage          |

**Critical execution note:** Steps T002–T004 (config file creation) must be completed **before** T005 (lint-staged update), because lint-staged will immediately invoke `prettier`, `yamllint`, and `actionlint` on the next `git commit` using those config files.

---

## Phase 1 — Setup

> Install the only new npm devDependency introduced by this stage. All other new tools (yamllint, actionlint) are system tools, not npm packages.

- [ ] T001 Install prettier as devDependency via `bun add -D prettier@^3` — `package.json`

---

## Phase 2 — Foundational: Configuration Files

> Create the three configuration files that must exist **before** lint-staged references them in T005. These tasks are independent of each other and may be executed in parallel.

- [ ] T002 [P] Create Prettier configuration with `printWidth: 100`, `proseWrap: "always"`, and `*.md` override block — `.prettierrc`

- [ ] T003 [P] Create Prettier ignore file excluding all Biome-managed types: `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.jsx`, `**/*.mjs`, `**/*.cjs`, `**/*.vue`, `**/*.json`, `**/*.jsonc`, plus `node_modules/`, `dist/`, `coverage/`, `docs/ai/context/` — `.prettierignore`

- [ ] T004 [P] Create yamllint configuration with `extends: default`, `line-length: max 120 (warning)`, `indentation: 2 spaces`, `document-start: warning`, `truthy.check-keys: false` — `.yamllint`

---

## Phase 3 — US1: Prettier Markdown Formatting (FR-02, FR-06)

> Integrate Prettier into the incremental pre-commit pipeline. After this phase, staging a `*.md` file triggers `prettier --write` automatically. yamllint and actionlint entries are also added here in a single atomic edit to `lint-staged.config.mjs`.

**Independent test criterion:** `prettier --check "**/*.md"` exits 0 from repo root after running `format:check:md`.

- [ ] T005 [US1] Update lint-staged configuration to add scope comment and three new entries — `lint-staged.config.mjs`
  - `'*.md': ['prettier --write']`
  - `'*.{yml,yaml}': ['yamllint']`
  - `'.github/workflows/*.yml': ['actionlint']`

- [ ] T006 [P] [US1] Add three new validation scripts after the existing `format:check` entry — `package.json`
  - `"format:check:md": "prettier --check \"**/*.md\""`
  - `"validate:yaml": "yamllint ."`
  - `"validate:workflows": "actionlint .github/workflows/"`

- [ ] T007 [P] [US3] Add actionlint full-repository scan block with graceful skip (no `.yml` files) and blocking `exit 1` on failure, positioned after `infra-audit.ts --quick` and before the unit tests block — `.husky/pre-push`

- [ ] T008 [US1] Verify Prettier markdown pipeline — run `bun run format:check:md` and confirm exit 0 with either zero violations or auto-formatted `*.md` file list — repo root

---

## Phase 4 — US2: yamllint YAML Validation (FR-03)

> yamllint is a system tool. Its lint-staged entry was added in T005. Its validation script was added in T006. Its configuration file was created in T004. No additional implementation tasks are required for this user story.

**Independent test criterion:** `bun run validate:yaml` exits 0 on all YAML files currently in the repository.

_All US2 implementation is complete after T004, T005, and T006._

---

## Phase 5 — US3: actionlint Workflow Validation (FR-04, FR-07)

> actionlint fires both in pre-commit (via lint-staged entry in T005) and in pre-push full scan (T007). Its validation script was added in T006. No additional implementation tasks are required for this user story.

**Independent test criterion:** `.husky/pre-push` contains the actionlint scan block; `bun run validate:workflows` exits 0 on all existing workflow files.

_All US3 implementation is complete after T005, T006, and T007._

---

## Phase 6 — US4: Unit Test Coverage

> Write and run unit tests that verify the structural correctness of the lint-staged configuration without executing toolchain binaries. 8 test cases required.

**Independent test criterion:** All 8 test cases pass via vitest; zero failures.

- [ ] T009 [US4] Create lint-staged config unit test file with all 8 test cases — `tests/unit/lint-staged/lint-staged-config.test.ts`
  - **T1:** Biome entry exists with command `['bun biome check --write']`
  - **T2:** Prettier entry exists for `'*.md'` with command `['prettier --write']`
  - **T3:** yamllint entry exists for `'*.{yml,yaml}'` with command `['yamllint']`
  - **T4:** actionlint entry exists for `'.github/workflows/*.yml'` with command `['actionlint']`
  - **T5:** No TS/JS key maps to a command containing `prettier`
  - **T6:** Key `'*.md'` does not map to any command containing `biome`
  - **T7:** Key `'*.{yml,yaml}'` does not map to any command containing `prettier`
  - **T8:** Config export is a plain object (`typeof config === 'object' && !Array.isArray(config)`)

- [ ] T010 [US4] Run unit test suite targeting the new test file and confirm 8 passed, 0 failed — `tests/unit/lint-staged/lint-staged-config.test.ts`

---

## Phase 7 — Polish & Regression Validation

> Confirm that the new configuration additions do not introduce Biome lint violations or TypeScript type errors anywhere in the monorepo.

- [ ] T011 [P] Run full Biome lint check across the monorepo via `bun run lint` and confirm exit 0 — repo root

- [ ] T012 [P] Run full TypeScript type check via `bun run typecheck` and confirm exit 0 — repo root

---

## Dependency Graph

```
T001 (install prettier)
  ├── T002 [P] (create .prettierrc)
  ├── T003 [P] (create .prettierignore)
  └── T004 [P] (create .yamllint)
        └── T005 [US1] (update lint-staged.config.mjs — all 3 entries)
              ├── T006 [P] [US1] (add package.json scripts)
              └── T007 [P] [US3] (update .husky/pre-push)
                    └── T008 [US1] (verify bun run format:check:md)
                          └── T009 [US4] (write lint-staged-config.test.ts)
                                └── T010 [US4] (run test suite)
                                      ├── T011 [P] (bun run lint)
                                      └── T012 [P] (bun run typecheck)
```

---

## Parallel Execution Map

| Parallel Group   | Tasks            | Available After | Condition                                               |
| ---------------- | ---------------- | --------------- | ------------------------------------------------------- |
| Config Files     | T002, T003, T004 | T001            | All create independent new files                        |
| Scripts + Hook   | T006, T007       | T005            | Modify different files (`package.json` vs `.husky/pre-push`) |
| Final Validation | T011, T012       | T010            | Independent commands — neither depends on the other     |

---

## Implementation Strategy

### MVP Scope (T001–T008)

Complete the pipeline integration without formal test coverage:

- Delivers: working hybrid lint format pipeline (prettier, yamllint, actionlint integrated)
- Does not deliver: unit test coverage, regression validation

### Full Scope (T001–T012)

Production-ready pipeline with verified tests and confirmed zero regressions:

- Delivers: all FRs satisfied, 8 unit tests passing, lint and typecheck clean
- Satisfies: stage testing requirement per plan.md

---

## Acceptance Criteria Traceability

| Task | FR Satisfied                                  | Acceptance Signal                                                    |
| ---- | --------------------------------------------- | -------------------------------------------------------------------- |
| T001 | FR-02 (partial), FR-10                        | `grep prettier package.json` returns a `^3.x` entry                 |
| T002 | FR-02, NFR-03                                 | `.prettierrc` exists at repo root with `printWidth: 100`             |
| T003 | FR-02, AI-02                                  | `.prettierignore` exists; `**/*.ts` and `**/*.vue` listed            |
| T004 | FR-03, NFR-03                                 | `.yamllint` exists at repo root with `extends: default`              |
| T005 | FR-06, FR-05 (additive)                       | `lint-staged.config.mjs` contains all 4 patterns                    |
| T006 | FR-02, FR-03, FR-04                           | `package.json` scripts include `format:check:md`, `validate:yaml`, `validate:workflows` |
| T007 | FR-07, FR-04                                  | `.husky/pre-push` contains actionlint block with graceful skip       |
| T008 | FR-02 (acceptance validation)                 | `bun run format:check:md` exits 0 from repo root                     |
| T009 | Testing Requirement                           | File created with 8 `describe/it` blocks                             |
| T010 | Testing Requirement                           | `bun run test:unit` reports 8 passed, 0 failed                       |
| T011 | NFR-01, regression safety                     | `bun run lint` exits 0 — no new Biome violations                     |
| T012 | Regression safety                             | `bun run typecheck` exits 0 — no type errors                         |

---

## TASKS_TOTAL: 12

| Category                                 | Tasks                    | Count |
| ---------------------------------------- | ------------------------ | ----- |
| Setup — npm install                      | T001                     | 1     |
| Foundational — config files (parallel)   | T002, T003, T004         | 3     |
| US1: Prettier Markdown (FR-02, FR-06)    | T005, T006, T008         | 3     |
| US3: actionlint Pre-Push (FR-07)         | T007                     | 1     |
| US4: Unit Tests                          | T009, T010               | 2     |
| Polish — regression validation (parallel) | T011, T012              | 2     |
| **Total**                                |                          | **12** |
