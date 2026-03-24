# Tasks: STAGE FIX 03 — Build, Test, and Repository Cleanliness Enforcement

**Stage**: STAGE_FIX_03
**Total Tasks**: 34
**Generated**: 2026-03-24
**Source**: plan.md (23-file manifest + 15 test files)

---

## Phase 1 — Foundation: Coordinated Type Migration (atomic — commit T001+T002+T003 together)

- [x] T001 Update `scripts/policy-engine/types.ts` — coordinated breaking type migration: remove `success`+`message`, add `passed`+`messages[]`+`domain`+`violatingPaths`+`deferralReport` to `PolicyResult`; add `domain`+`severity` to `PolicyRule`; add `autoFixedPaths: string[]` to `PolicyContext`; add `ArtifactSnapshot` and `DeferralReport` interfaces
- [x] T002 Update `scripts/policy-engine/runner.ts` — wire GitNexus context (read `docs/ai/context/gitnexus-context.json`), implement `--changed` / `--full` CLI flags, generate `correlationId`, structured JSON stdout per rule, final summary aggregation, exit codes 0/1/2, import-failure guard (exit 2)
- [x] T003 Update `scripts/policy-engine/registry.ts` — register 9 rules in execution order: `RULE_FIX_03_ENVIRONMENT_READY`, `RULE_FIX_03_AUTO_FIX_ATTEMPT`, `RULE_FIX_03_BUILD_PASS`, `RULE_FIX_03_TEST_PASS`, `RULE_FIX_03_TEST_ISOLATION`, `RULE_FIX_03_REPO_CLEAN`, `RULE_FIX_03_NO_ARTIFACT_DRIFT`, `RULE_FIX_03_ARTIFACT_ALLOWLIST`, `RULE_FIX_03_COVERAGE_THRESHOLD`

## Phase 2 — Supporting Scripts (parallel group)

- [x] T004 [P] Create `scripts/validate/validate-runtime-env.ts` — probe PostgreSQL reachability (env-overrideable port), Redis reachability, Bun version vs `engines.bun` in root `package.json`, Node >= 20; structured JSON output on failure; exit 0 on pass, non-zero on failure
- [x] T005 [P] Create `scripts/validate/repo-assert-clean.ts` — run `git status --porcelain`, fail with structured JSON listing all dirty paths if output non-empty; exit 0 on clean, exit 1 with path list on dirty
- [x] T006 [P] Create `scripts/validate/repo-detect-artifacts.ts` — scan for prohibited artifact paths: `coverage/**`, `.tmp/**`, `tmp/**`, `**/.output/**`, `**/playwright-report/**`, `**/test-results/**`, `**/test-perf-output/**`, `**/test-perf-output-2/**`; structured JSON output with `violatingPaths[]`; exit 0 if clean
- [x] T007 [P] Create `scripts/validate/repo-hash-build.ts` — enumerate all files under `dist/**` workspaces using `git ls-files`, hash each file (SHA-256), output snapshot as `{ timestamp, baseRef, trackedFiles, hashes }` JSON; exit 0 always (read-only snapshot)

## Phase 3 — Package.json Script Entries

- [x] T008 Update root `package.json` — verify `validate:policy` entry at line ~116 is unchanged; add four new script entries: `"validate:runtime-env": "bun run scripts/validate/validate-runtime-env.ts"`, `"repo:assert-clean": "bun run scripts/validate/repo-assert-clean.ts"`, `"repo:detect-artifacts": "bun run scripts/validate/repo-detect-artifacts.ts"`, `"repo:hash-build": "bun run scripts/validate/repo-hash-build.ts"`

## Phase 4 — Rule Implementations (parallel group; requires Phase 1 complete)

- [x] T009 [P] Create `scripts/policy-engine/rules/fix-03/environment-ready.ts` — invoke `scripts/validate/validate-runtime-env.ts` via subprocess; hard-fail runner exit if this rule fails; `domain: "infra"`, `severity: "error"`; always runs (not `--changed` scoped)
- [x] T010 [P] Create `scripts/policy-engine/rules/fix-03/auto-fix-attempt.ts` — run `bun run lint:fix && bun run format` on scoped files (changedFiles in `--changed`, all files in `--full`); re-run `bun run typecheck`; populate `context.autoFixedPaths` with all modified file paths; warning if auto-fix resolved issues; error if typecheck still fails after fix; `domain: "code-quality"`, `severity: "warning"`; `--changed` scoped
- [x] T011 [P] Create `scripts/policy-engine/rules/fix-03/build-pass.ts` — invoke `bun run build` (scoped to impacted workspaces in `--changed` mode); report failing package names in `violatingPaths`; `domain: "build"`, `severity: "error"`; `--changed` scoped
- [x] T012 [P] Create `scripts/policy-engine/rules/fix-03/test-pass.ts` — invoke `bun run test:unit` (or scoped `vitest run --project <workspace>` in `--changed` mode); report failing test file paths in `violatingPaths`, failing test names in `messages`; `domain: "test"`, `severity: "error"`; `--changed` scoped
- [x] T013 [P] Create `scripts/policy-engine/rules/fix-03/test-isolation.ts` — invoke `scripts/init-test-db.sh` and `scripts/reset-test-redis.sh` via subprocess; confirm both exit 0; fail with structured error if either exits non-zero; `domain: "test"`, `severity: "error"`; always runs
- [x] T014 [P] Create `scripts/policy-engine/rules/fix-03/repo-clean.ts` — invoke `scripts/validate/repo-assert-clean.ts` via subprocess; exclude any paths in `context.autoFixedPaths` from dirty-tree check; report remaining violating paths; `domain: "repo"`, `severity: "error"`; always runs
- [x] T015 [P] Create `scripts/policy-engine/rules/fix-03/no-artifact-drift.ts` — capture `ArtifactSnapshot` (current `git status --short` output + `git ls-files`); compare against rule's start-of-run snapshot; report any files appearing in prohibited directories since rule start; `domain: "repo"`, `severity: "error"`; always runs
- [x] T016 [P] Create `scripts/policy-engine/rules/fix-03/artifact-allowlist.ts` — invoke `scripts/validate/repo-detect-artifacts.ts` via subprocess; parse JSON output; each match in `violatingPaths`; `domain: "repo"`, `severity: "error"`; always runs
- [x] T017 [P] Create `scripts/policy-engine/rules/fix-03/coverage-threshold.ts` — `--full` mode only (skip in `--changed`); invoke `bun run test:unit --coverage`; parse coverage JSON; checkglobal >= 70% and critical modules >= 80%; emit `warning` (never `error`) on breach; include thresholds and actuals in `messages`; populate `deferralReport`; `domain: "test"`, `severity: "warning"`

## Phase 5 — Unit Tests (parallel group; requires Phase 1–4 complete)

- [x] T018 [P] Create `tests/policy-engine/fix-03/types.test.ts` — type guards `isPolicyResult` and `isDeferralReport`; all required fields present; `passed === (severity !== 'error')` invariant; `autoFixedPaths` field present on `PolicyContext`
- [x] T019 [P] Create `tests/policy-engine/fix-03/runner.test.ts` — rule execution ordering matches registry; exit code 0 all pass; exit code 1 any error-severity; exit code 2 on import failure; correlationId format; no-op on empty `--changed`; final summary JSON shape
- [x] T020 [P] Create `tests/policy-engine/fix-03/registry.test.ts` — all 9 rules registered; `id` uniqueness; execution order contract (ENVIRONMENT_READY first); import resolution
- [x] T021 [P] Create `tests/policy-engine/fix-03/rules/environment-ready.test.ts` — PG reachable → pass; PG unreachable → structured error JSON; Redis unreachable → error; Bun version mismatch → error; Node < 20 → error; output shape validation
- [x] T022 [P] Create `tests/policy-engine/fix-03/rules/auto-fix-attempt.test.ts` — fix succeeds and typecheck passes → `passed: true`, `severity: "warning"`, `deferralReport` present; fix applied but typecheck still fails → `passed: false`, `severity: "error"`; `autoFixedPaths` populated
- [x] T023 [P] Create `tests/policy-engine/fix-03/rules/build-pass.test.ts` — all workspaces build → pass; failing workspace name in `violatingPaths`; structured JSON shape
- [x] T024 [P] Create `tests/policy-engine/fix-03/rules/test-pass.test.ts` — all tests pass → empty `violatingPaths`; failing test file in `violatingPaths`; failing test name in `messages`
- [x] T025 [P] Create `tests/policy-engine/fix-03/rules/test-isolation.test.ts` — init-test-db.sh exits 0 → pass; exits non-zero → `passed: false` with structured error; reset-test-redis.sh same
- [x] T026 [P] Create `tests/policy-engine/fix-03/rules/repo-clean.test.ts` — clean tree → pass; dirty file in `violatingPaths`; autoFixedPaths exclusion: file in `autoFixedPaths` is not in `violatingPaths` even if dirty
- [x] T027 [P] Create `tests/policy-engine/fix-03/rules/no-artifact-drift.test.ts` — no new prohibited files → pass; new file in `tmp/` → `violatingPaths`; snapshot diff correctness
- [x] T028 [P] Create `tests/policy-engine/fix-03/rules/artifact-allowlist.test.ts` — no prohibited files → empty `violatingPaths`; file under `coverage/` → in `violatingPaths`; file under `test-perf-output/` → in `violatingPaths`
- [x] T029 [P] Create `tests/policy-engine/fix-03/rules/coverage-threshold.test.ts` — above thresholds → `passed: true`; below global threshold → `passed: true`, `severity: "warning"`, `deferralReport` present; severity is never `"error"`
- [x] T030 [P] Create `tests/policy-engine/fix-03/scripts/validate-runtime-env.test.ts` — all services available → exit 0; PG missing → exit 1, structured JSON; port env override respected
- [x] T031 [P] Create `tests/policy-engine/fix-03/scripts/repo-assert-clean.test.ts` — clean tree → exit 0; modified file → exit 1, structured JSON with dirty paths; invoked twice on clean repo → same exit 0 (idempotency)
- [x] T032 [P] Create `tests/policy-engine/fix-03/scripts/repo-detect-artifacts.test.ts` — no prohibited files → empty JSON; `coverage/lcov.info` present → `violatingPaths` includes it; `test-perf-output-2/` file present → also reported

## Phase 6 — CI and Husky Infrastructure

- [x] T033 Update `.github/workflows/ci.yml` — add `policy-gate` job (runs-on: ubuntu-latest, needs: [lint, typecheck, unit-tests, integration-tests, coverage-validation], step: `bun run validate:policy --full`); update `ci-success.needs` to reference `policy-gate` instead of `build-verification`; remove `build-verification` job
- [x] T034 Update `.husky/pre-push` — replace step 4 (`bun run test:unit`) and step 5 (standalone `tsc`) with single step: `bun run validate:policy -- --changed`; architecture governance steps (ai-guard, infra-audit, validate-architecture-brain) remain unchanged before this step

---

**Total**: 34 tasks
**Deferred**: `RULE_FIX_03_FLAKY_TEST_DETECTION` — deferred to follow-up stage (requires history-tracking infrastructure not in scope)
