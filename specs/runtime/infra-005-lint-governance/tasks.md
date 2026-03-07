# tasks.md — Lint Governance

**Stage:** STAGE_INFRA_05_LINT_GOVERNANCE
**Phase:** 01_PLATFORM_FOUNDATION
**Feature:** `infra-005-lint-governance`
**Plan:** `specs/runtime/infra-005-lint-governance/plan.md`
**Spec:** `specs/runtime/infra-005-lint-governance/spec.md`
**Research:** `specs/runtime/infra-005-lint-governance/research.md`
**Package Manager:** `bun`
**Branch:** `spec/infra-005-lint-governance`
**Generated:** 2026-03-07

---

## Stage Compliance Check

| Rule                                   | Status          |
| -------------------------------------- | --------------- |
| Constitution v1.2.0 alignment          | ✅ APPROVED     |
| No cross-tenant access introduced      | ✅ Confirmed    |
| No middleware bypass introduced        | ✅ Confirmed    |
| No grading logic changes               | ✅ Confirmed    |
| No direct DB instantiation             | ✅ Confirmed    |
| No runtime dependencies introduced     | ✅ devDeps only |
| Stage scope: toolchain governance only | ✅ Confirmed    |

---

## Pre-Stage Gate

Before executing tasks, confirm all of the following are true:

- `biome.json` exists at repo root (`@biomejs/biome ^2.4.6`)
- `bun run lint` executes (violations may exist — that is expected)
- `.github/workflows/ci.yml` exists
- `.husky/pre-commit` exists with `bunx lint-staged` and `bun scripts/ai-guard.ts`
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` exists
- `docs/architecture/intelligence/ARCHITECTURE_MAP.json` exists

If any prerequisite is missing, **stop and resolve it before proceeding.**
`infra-004-biome` must be COMPLETE for this stage to begin.

---

## Phase 1 — Pre-Activation Baseline

> **Goal:** Measure the current lint violation state before tightening any rules.
> Establishes a documented before/after baseline and surface any `noUnreachable` warnings
> that must be resolved before `noUnreachable: error` is activated.

- [ ] T001 Run `bun biome check . --reporter=json 2>&1 | tee /tmp/lint-baseline.json && echo "Baseline captured at /tmp/lint-baseline.json"` to capture full baseline violation report before making any changes
- [ ] T002 Run `bun run lint:fix` to auto-fix all currently auto-fixable formatting, import ordering, and safe lint violations across the full monorepo (applies to all `*.{ts,tsx,js,jsx,mjs,vue,json}` files per `biome.json`)
- [ ] T003 Run `bun run lint 2>&1 | grep -i "noUnreachable\|unreachable" || echo "No noUnreachable violations found"` to identify and record all remaining `noUnreachable` warnings requiring manual resolution; note the count before advancing to Phase 2

---

## Phase 2 — Core Changes

> **Goal:** Apply every targeted change defined in plan.md — biome.json, CI pipeline,
> pre-commit hook, and governance documentation.
> Tasks T004, T009, and T010 operate on independent files and may be executed in parallel.

### 2a — biome.json: Rule Hardening

- [ ] T004 [P] In `biome.json`, change the `noUnreachable` rule severity in `linter.rules.correctness` from `{ "level": "warn" }` to `{ "level": "error" }` — this is the only rule change required; all other rules and all overrides remain unchanged

### 2b — CI Pipeline: .github/workflows/ci.yml

- [ ] T005 In `.github/workflows/ci.yml`, in the `lint` job, remove or replace the two-step lint sequence (`bun biome check .` followed by `bun biome format .`) with a single `bun run lint` step; use step name "Run Biome lint + format check" — this eliminates the redundant format step while preserving CI/local parity
- [ ] T006 In `.github/workflows/ci.yml`, add a new `arch-guard` job with the following specification:

  ```yaml
  arch-guard:
    name: 'AI-Guard — Architecture Boundaries'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs:
      - lint
      - typecheck
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run AI-Guard architecture check
        run: bun scripts/ai-guard.ts
  ```

  Place this job after the `typecheck` job definition, before `unit-tests`.

- [ ] T007 In `.github/workflows/ci.yml`, add `arch-guard` to the `needs` list of the `unit-tests` job so it becomes a blocking prerequisite (the job must not start until AI-Guard passes)
- [ ] T008 In `.github/workflows/ci.yml`, add `arch-guard` to the `needs` list of the `integration-tests` job so it becomes a blocking prerequisite (same pattern as T007)

### 2c — Pre-Commit Hook: Stale Comment Fix

- [ ] T009 [P] In `.husky/pre-commit`, update the stale lint-staged comment on the line reading "Runs ESLint --fix + Prettier --write on staged .ts/.tsx/.vue/.md/.json files." — replace it with "Runs Biome check --write on staged .ts/.tsx/.js/.jsx/.mjs/.vue/.json files." — this is a documentation-only fix; the `bunx lint-staged` command itself does not change

### 2d — Governance Documentation

- [ ] T010 [P] Create `docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md` with all of the following sections:
  1. **Overview** — purpose and scope of this governance document
  2. **Four Governance Layers** — table: layer name, role, trigger (Biome/lint-staged, AI-Guard, Infra-Audit, Tests)
  3. **Import Order Convention** — 5-group canonical order with code examples (node:built-ins → external packages → `@zidney/*` internal → app-local → relative), blank line between groups, how to auto-fix with `bun run lint:fix`
  4. **Module Ownership: Critical Infrastructure Packages** — table listing `packages/domain-core`, `packages/types`, `packages/validation`, `packages/logger`, `packages/config` with criticality tier and machine-readable field reference (`ARCHITECTURE_MAP.json` criticality field)
  5. **Developer Commit Workflow** — numbered step-by-step sequence: write code → `git add` → `git commit` → hooks fire (lint-staged → AI-Guard → infra-audit --quick) → commit recorded → `git push` → CI gates (lint → typecheck → arch-guard → unit-tests)
  6. **Emergency Override Procedure** — document `git commit --no-verify` with bold warning that: (a) CI will still catch the violation, (b) merge is blocked if CI fails, (c) `--no-verify` must never be used to bypass architectural violations permanently
  7. **Drift Recovery Playbook** — step-by-step: `bun run arch:audit` (identify drift) → `bun run arch:fix` (auto-register unmapped modules) → `bun run arch:refresh` (full refresh) → `bun scripts/ai-guard.ts` (verify enriched mode) → commit refreshed artifacts
  8. **CI Gate Sequence** — ordered table: lint (`bun run lint`) → typecheck (`bun run typecheck`) → arch-guard (`bun scripts/ai-guard.ts`) → unit-tests (`bun run test:unit`) → integration-tests; all gates blocking; each job's `needs` dependency shown

---

## Phase 3 — Fix Baseline Violations

> **Goal:** Resolve any `noUnreachable` warnings found in T003 that could not be auto-fixed.
> If T003 output was "No noUnreachable violations found", all tasks in this phase are no-ops —
> mark T011 and T012 complete with note "no violations found" and proceed directly to Phase 4.

- [ ] T011 For each `noUnreachable` violation identified in T003: either (a) remove the unreachable code block — preferred — or (b) if the unreachable code is intentional (e.g., assertion-only path), add `// biome-ignore lint/correctness/noUnreachable: <rationale>` on the line immediately above, replacing `<rationale>` with a specific explanation; apply to all files listed
- [ ] T012 Run `bun run lint` to confirm all `noUnreachable` violations from T003 are now resolved; exit code must be 0 (or zero `noUnreachable` violations remain — other `warn`-level rules may still emit warnings)

---

## Phase 4 — Validation and Verification

> **Goal:** Confirm every change made in Phases 2 and 3 is correct, all CI gates pass locally,
> and the full governance pipeline is operational end-to-end.

- [ ] T013 Run `bun run lint` — must exit code 0; confirm `noUnreachable` violations are gone; this validates both the biome.json change (T004) and the Phase 3 fixes (T011–T012)
- [ ] T014 [P] Run `bun run typecheck` — must exit code 0; confirm no TypeScript errors were introduced by any change in this stage
- [ ] T015 [P] Run `bun scripts/ai-guard.ts` — must exit code 0; confirm AI-Guard runs without fatal errors and both `ARCHITECTURE_MAP.json` and `ARCHITECTURE_CONTRACT.json` are detected; brain-enriched mode preferred but fallback mode also acceptable
- [ ] T016 Confirm `biome.json` `assist.actions.source.organizeImports` is set to `"on"`; run `bun run lint:fix` on one sample file (e.g., `apps/api/src/index.ts`) and verify imports are auto-sorted into the correct 5-group order
- [ ] T017 Verify `lint-staged.config.mjs` contains exactly `'*.{ts,tsx,js,jsx,mjs,vue,json}': ['bun biome check --write']`; no change should have been made to this file — this is a read-only verification
- [ ] T018 Verify `.husky/pre-commit` contains: (a) updated Biome comment from T009, (b) `bunx lint-staged` command, (c) `bun scripts/ai-guard.ts` command, (d) `bun scripts/infra-audit.ts --quick` command — all present and correct
- [ ] T019 Verify `.github/workflows/ci.yml` satisfies all three conditions: (a) `arch-guard` job exists with `needs: [lint, typecheck]`, (b) `unit-tests` job `needs` list includes `arch-guard`, (c) `lint` job contains `bun run lint` with no separate `bun biome format .` step
- [ ] T020 Open `docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md` and verify all 8 sections from T010 are present and complete; confirm the emergency override procedure includes the `--no-verify` warning; confirm the drift recovery playbook lists all 6 steps
- [ ] T021 Open `docs/architecture/intelligence/ARCHITECTURE_MAP.json` and confirm the `criticality` field is present for all five critical packages: `packages/domain-core` (`core`), `packages/types` (`core`), `packages/validation` (`core`), `packages/logger` (`infrastructure`), `packages/config` (`infrastructure`)

---

## Dependency Graph

```
T001                           ← capture baseline
  ↓
T002                           ← auto-fix
  ↓
T003                           ← identify remaining violations
  ↓
┌──────────────────────────────────────────────────────────┐
│ T004 [P]   T005      T009 [P]   T010 [P]                 │
│ biome.json  ci.yml    pre-commit  docs/governance/         │
│ (parallel)  lint fix  fix        LINT_GOVERNANCE.md       │
│              ↓                   (parallel)               │
│             T006                                          │
│             ci.yml arch-guard job                         │
│              ↓                                            │
│             T007   T008                                   │
│             ci.yml unit-tests/integration-tests needs     │
└──────────────────────────────────────────────────────────┘
  ↓ (all Phase 2 complete)
T011                           ← fix violations (or no-op)
  ↓
T012                           ← verify fixes pass lint
  ↓
T013                           ← validate: bun run lint
  ↓
┌────────────────────┐
│  T014 [P]  T015 [P] │
│  typecheck  ai-guard │
│  (parallel)         │
└────────────────────┘
  ↓
T016 → T017 → T018 → T019 → T020 → T021
(verification sequence)
```

---

## Parallel Execution Guide

| Set   | Tasks            | Why Parallel                                                                    | Constraint       |
| ----- | ---------------- | ------------------------------------------------------------------------------- | ---------------- |
| Set A | T004, T009, T010 | Touch independent files (`biome.json`, `.husky/pre-commit`, `docs/governance/`) | Start after T003 |
| Set B | T014, T015       | Independent commands; no file writes                                            | Start after T013 |

**Note:** T005 → T006 → T007 → T008 are sequential edits to the same file (`.github/workflows/ci.yml`) and must be applied in order.

---

## Implementation Strategy

**MVP path** (minimum changes to reach a passing state):

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012
```

**Validation gate** (non-optional — all must pass before stage closes):

```
T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021
```

**Suggested commit sequence:**

1. After Phase 1: `git add -A && git commit -m "chore: lint-governance baseline auto-fix [infra-005]"`
2. After Phase 2: `git add biome.json .github/workflows/ci.yml .husky/pre-commit docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md && git commit -m "feat: activate lint governance layer [infra-005]"`
3. After Phase 3 (if violations fixed): `git add <files> && git commit -m "fix: resolve noUnreachable violations before governance hardening [infra-005]"`

---

## Stage Completion Criteria

All of the following must be true before this stage is marked COMPLETE:

| Criterion                                                                                       | Verified By |
| ----------------------------------------------------------------------------------------------- | ----------- |
| `bun run lint` exits code 0 across full monorepo                                                | T013        |
| `bun run typecheck` exits code 0                                                                | T014        |
| `bun scripts/ai-guard.ts` exits code 0                                                          | T015        |
| `biome.json` has `noUnreachable: error` in `linter.rules.correctness`                           | T013, T016  |
| `biome.json` import organizer (`organizeImports: on`) confirmed active                          | T016        |
| `.github/workflows/ci.yml` has `arch-guard` job                                                 | T019        |
| `.github/workflows/ci.yml` test jobs have `needs: arch-guard`                                   | T019        |
| `.github/workflows/ci.yml` lint job uses `bun run lint` only                                    | T019        |
| `.husky/pre-commit` stale ESLint/Prettier comment replaced                                      | T018        |
| `docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md` created with 8 sections                                    | T020        |
| Stage status updated in `specs/phases/01_platform_foundation/STAGE_INFRA_05_LINT_GOVERNANCE.md` | Manual      |
