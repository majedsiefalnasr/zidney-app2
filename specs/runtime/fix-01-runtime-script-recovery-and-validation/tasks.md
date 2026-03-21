# Tasks — Runtime Script Recovery and Validation

## Stage Context

- **Phase:** 0X_FIXES
- **Stage:** STAGE_FIX_01_RUNTIME_SCRIPT_RECOVERY_AND_VALIDATION
- **Related Plan:** `specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md`
- **Related Spec:** `specs/runtime/fix-01-runtime-script-recovery-and-validation/spec.md`
- **Related ADR:** None required (infrastructure fix stage)
- **Package Manager:** bun
- **Branch:** `spec/fix-01-runtime-script-recovery-and-validation`

---

## Constitutional Compliance

Validated against Zidney Constitution v1.2.0:

- No tenant isolation impact
- No license middleware changes
- No attempt engine modifications
- No schema alterations
- No new packages under `packages/`
- No application routes

---

## Phase 1 — Setup

### Goals

- Verify shared logger factory is resolvable from new domain subdirectories
- Confirm all domain script directories exist on disk

### Tasks

- [x] T001 Verify `scripts/core/logger-factory.ts` exports `createLogger` and is importable via `../core/logger-factory` from one-level-deep domain subdirectories — scripts/core/logger-factory.ts
- [x] T002 Confirm directories exist: `scripts/db/`, `scripts/validate/`, `scripts/seed/`, `scripts/generate/`, `scripts/maintenance/` (create any missing ones) — scripts/ domain subdirs

---

## Phase 2 — Foundational: Scan & Inventory Tooling

### Goals

Produce the authoritative scan artifact (`audits/runtime-script-scan.json`) and the initial
Script Registry (`docs/scripts/SCRIPT_REGISTRY.md`). These objects are prerequisites for
validating all Phase 3 work.

### Independent Test Criteria

- `bun run scripts/validate/scan-package-scripts.ts` exits 0 and writes valid JSON to
  `audits/runtime-script-scan.json`
- `docs/scripts/SCRIPT_REGISTRY.md` contains all 79 in-scope script references (83 total − 4
  excluded) with correct status columns

### Tasks

- [x] T003 Create `scripts/validate/scan-package-scripts.ts` — walks `specs/runtime/**/*.md`, applies regex `bun run ([a-zA-Z][a-zA-Z0-9:_-]*)` per line, excludes CLI-flag forms and the four excluded names, deduplicates by exact match, outputs `audits/runtime-script-scan.json` with schema matching plan.md §Phase 0 — scripts/validate/scan-package-scripts.ts
- [x] T004 Create `scripts/validate/diff-script-registry.ts` — loads scan output JSON and root `package.json` scripts keys, computes missing/unregistered/alias-needed diff, outputs diff report JSON to `audits/script-registry-diff.json` — scripts/validate/diff-script-registry.ts
- [x] T005 Create `scripts/validate/detect-broken-scripts.ts` — for each script entry in root `package.json` that resolves to a `.ts` file path, checks file existence on disk and runs `bun build --dry-run` import resolution; classifies result as VALID / MISSING / BROKEN and logs summary — scripts/validate/detect-broken-scripts.ts
- [x] T006 Execute `bun run scripts/validate/scan-package-scripts.ts` from repo root → write output to `specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/runtime-script-scan.json` — specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/runtime-script-scan.json
- [x] T007 Execute `bun run scripts/validate/diff-script-registry.ts` → write initial `docs/scripts/SCRIPT_REGISTRY.md` table from diff output (columns: Script, Domain, Location, Mode, Status — pre-fix state) — docs/scripts/SCRIPT_REGISTRY.md

---

## Phase 3 — US1: Script Reconstruction & Root Registration

> **US1 Goal:** Every `bun run <script>` referenced in runtime specs exists, executes cleanly,
> and is registered in root `package.json` only.

### Independent Test Criteria

- `bun run db:status:pool` exits 0 (or exits 0 with structured infra-absent warn log)
- `bun run db:validate:licenses` exits 0 (infra-absent pattern)
- `bun run db:migrate` exits 0 (infra-absent pattern)
- `bun run db:console` exits 0 (infra-absent pattern)
- `bun run validate:ai-context-fresh` exits 0 or 1 with structured log (no unhandled exception)
- `bun run validate:ai-context-schemas` exits 0 or 1 with structured log
- `bun run infra:cache:clean` exits 0
- `bun run dev:seed:dashboard-test-data` exits 0 (infra-absent)
- Root `package.json` contains all 29 new registrations listed in plan.md §T006

### Tasks

#### Seed Script Deduplication (T004 — plan phase 1)

- [x] T008 [US1] Compare `scripts/seed-dashboard-test-data.ts` vs `scripts/dev/seed-dashboard-test-data.ts` line-by-line; confirm `scripts/dev/` version is canonical (superset per Task T038 move note); document merge rationale in JSDoc header — scripts/dev/seed-dashboard-test-data.ts
- [x] T009 [US1] Create `scripts/seed/dashboard-test-data.ts` by moving canonical content from `scripts/dev/seed-dashboard-test-data.ts`; add JSDoc merge header documenting absorbed-from sources; replace all `console.log` calls with `createLogger('seed:dashboard-test-data')` structured equivalents per spec FR-05 (CORRELATION_ID prefix maps to `correlationId` field) — scripts/seed/dashboard-test-data.ts
- [x] T010 [US1] Delete `scripts/seed-dashboard-test-data.ts` (root-level duplicate, post-move verification required) — scripts/seed-dashboard-test-data.ts
- [x] T011 [US1] Delete `scripts/dev/seed-dashboard-test-data.ts` (prior location, now superseded by scripts/seed/) — scripts/dev/seed-dashboard-test-data.ts

#### DB Domain Scripts — New Implementations (T005/Group A — plan phase 1)

- [x] T012 [P] [US1] Create `scripts/db/pool-status.ts` — JSDoc metadata header, `createLogger` via `../core/logger-factory`, `randomUUID` correlationId, `DATABASE_URL` infra-absent exit-0 pattern, dynamic `pg.Pool` connect/ping/release, structured logs for all branches — scripts/db/pool-status.ts
- [x] T013 [P] [US1] Create `scripts/db/validate-licenses.ts` — JSDoc metadata header, `createLogger` via `../core/logger-factory`, correlationId, `DATABASE_URL` infra-absent exit-0 pattern, GROUP BY status license query, structured summary log — scripts/db/validate-licenses.ts
- [x] T014 [US1] Check/fix `scripts/db/migrate.ts` — verify file exists; if missing, create per plan.md §T005/Group A spec; if exists, audit imports for `../core/logger-factory` pattern and infra-absent path; add/fix JSDoc metadata header; service: `db:migrate` — scripts/db/migrate.ts
- [x] T015 [P] [US1] Create `scripts/db/console.ts` — JSDoc metadata header, `createLogger('db:console')`, correlationId, `DATABASE_URL` infra-absent exit-0, `spawnSync('which', ['psql'])` availability check, `spawnSync('psql', [databaseUrl], { stdio: 'inherit' })` launcher (no --workspace= arg; caller sets DATABASE_URL directly) — scripts/db/console.ts

#### Validate Domain Scripts — New Implementations (T005/Group B — plan phase 1)

- [x] T016 [P] [US1] Create `scripts/validate/ai-context-fresh.ts` — JSDoc metadata header, `createLogger('validate:ai-context-fresh')`, correlationId, check existence of `docs/ai/context/ai-context-mini.json`, `statSync` age check vs 24h MAX_AGE_MS, exit 1 with structured error if missing or stale, exit 0 with age log if fresh — scripts/validate/ai-context-fresh.ts
- [x] T017 [P] [US1] Create `scripts/validate/ai-context-schemas.ts` — JSDoc metadata header, `createLogger('validate:ai-context-schemas')`, correlationId, iterate REQUIRED_ARTIFACTS list (ai-layer-model.json, ai-module-map.json, ai-dependency-graph.json, ai-context-mini.json, ai-architecture-brain.json), `JSON.parse` each, collect errors, exit 1 on any error, exit 0 on all valid — scripts/validate/ai-context-schemas.ts

#### Maintenance Domain Scripts — New Implementation (T005/Group C — plan phase 1)

- [x] T018 [P] [US1] Create `scripts/maintenance/cache-clean.ts` — JSDoc metadata header, `createLogger('maintenance:cache-clean')`, correlationId, CACHE_DIRS array (`.turbo`, `node_modules/.cache`, `apps/*/dist`), `existsSync` + `rmSync` per dir, removed/skipped counters, structured completion log — scripts/maintenance/cache-clean.ts

#### Root package.json Registration (T006 — plan phase 1)

- [x] T019 [US1] Add new TypeScript implementation script registrations to root `package.json` scripts block: `db:console`, `db:migrate`, `db:pool-status`, `db:validate-licenses`, `maintenance:cache-clean`, `seed-dashboard-test-data`, `validate:ai-context-fresh`, `validate:ai-context-schemas` (generate-script-docs and validate-runtime-scripts registered in their own phases) — package.json
- [x] T020 [US1] Add previously unregistered implementation registrations to root `package.json` scripts block: `ai-guard` → `bun run scripts/ai-guard.ts`, `run-staging-smoke-tests` → `bash scripts/ci/run-staging-smoke-tests.sh` — package.json
- [x] T021 [US1] Add all 17 alias registrations to root `package.json` scripts block: `ai-context:status`, `biome`, `build:api`, `build:packages`, `ci:test`, `dev`, `generate:ai-context`, `infra-audit`, `infra-audit:check`, `migrate`, `test:ci`, `tsc`, `type-check`, `type-coverage`, `validate:architecture`, `vitest`, `worker` — package.json

---

## Phase 4 — US3: CI Guard Script

> **US3 Goal:** `bun run validate:runtime:scripts` hard-blocks (exit 1) when any `bun run <script>`
> reference in `specs/runtime/**` is absent from root `package.json`; exits 0 when all are
> registered.

### Independent Test Criteria

- `bun run validate:runtime:scripts` exits 0 after Phase 3 registration is complete
- Unit test: `extractScriptReferences` correctly extracts script names from markdown content
- Unit test: excluded names (`my-new-script`, `scripts`, `wrapper`, `lint:staged`) are filtered
- Unit test: CLI flag forms (`bun run --watch`) do not produce a match
- Unit test: `loadRegisteredScripts` returns a `Set<string>` from `package.json` scripts keys
- Unit test: missing script reference → returns non-empty array
- Unit test: all-registered → returns empty array
- `bun run test:unit` for `scripts/validate/__tests__/runtime-scripts.test.ts` passes

### Tasks

- [x] T022 [US3] Create `scripts/validate/runtime-scripts.ts` — JSDoc metadata header, `createLogger('validate-runtime-scripts')`, correlationId, export `SCRIPT_REGEX`, `EXCLUDED_NAMES`, `walkMarkdownFiles`, `extractScriptReferences`, `loadRegisteredScripts`; `main()` walks `specs/runtime/`, computes missing set, logs each missing script as structured error, exits 1 on any missing, exits 0 when all registered — scripts/validate/runtime-scripts.ts
- [x] T023 [US3] Register `validate-runtime-scripts` in root `package.json` scripts block: `"validate-runtime-scripts": "bun run scripts/validate/runtime-scripts.ts"` — package.json
- [x] T024 [US3] Create `scripts/validate/__tests__/runtime-scripts.test.ts` — six Vitest test cases covering: standard extraction, excluded-name filter, CLI-flag non-match, loadRegisteredScripts set return, missing-script detection, all-registered no-error; also add a `scripts/validate` project entry to `vitest.workspace.ts` matching the ai-engine/hygiene-checks precedent so the test file is discovered by the workspace runner — scripts/validate/**tests**/runtime-scripts.test.ts, vitest.workspace.ts
- [x] T025 [US3] Run unit tests for runtime-scripts: `bun run test:unit` scoped to `scripts/validate/__tests__/runtime-scripts.test.ts` → verify all 6 tests pass

---

## Phase 5 — US2: Documentation & Documentation Generator

> **US2 Goal:** Every recovered script has an individual `docs/scripts/<script>.md` page covering
> all required sections; `generate-script-docs` can regenerate the full `docs/scripts/` tree from
> `@script` metadata headers without manual editing.

### Independent Test Criteria

- `docs/scripts/README.md` exists with domain-grouped table of contents
- `docs/scripts/SCRIPT_REGISTRY.md` is present and lists all 79 in-scope scripts
- Each of the 10 recovered scripts has a `docs/scripts/<script>.md` with all 8 required sections
- `bun run dev:generate:script-docs` exits 0 and overwrites/regenerates doc files from metadata headers
- `bun run dev:generate:script-docs` exits 1 if any script violates the `<domain>:<action>` naming convention

### Tasks

#### docs/scripts/ Directory Bootstrap

- [x] T026 [US2] Create `docs/scripts/README.md` — index file with: purpose of Script Knowledge Base, how to add new script docs, link to SCRIPT_REGISTRY.md, domain-grouped table of contents linking each individual doc page — docs/scripts/README.md

#### Individual Script Documentation Pages (all independently parallelizable post-T026)

- [x] T027 [P] [US2] Write `docs/scripts/db-pool-status.md` — all 8 required sections: Command, Purpose, Why It Exists, When to Run, Execution Mode, Dependencies, Example Usage, Known Failure Modes — docs/scripts/db-pool-status.md
- [x] T028 [P] [US2] Write `docs/scripts/db-validate-licenses.md` — all 8 required sections — docs/scripts/db-validate-licenses.md
- [x] T029 [P] [US2] Write `docs/scripts/db-migrate.md` — all 8 required sections; note `--workspace=` and `--migration=` CLI args — docs/scripts/db-migrate.md
- [x] T030 [P] [US2] Write `docs/scripts/db-console.md` — all 8 required sections; note psql PATH dependency (no `--workspace=` arg — connects to DATABASE_URL directly) — docs/scripts/db-console.md
- [x] T031 [P] [US2] Write `docs/scripts/validate-ai-context-fresh.md` — all 8 required sections; note 24h staleness threshold — docs/scripts/validate-ai-context-fresh.md
- [x] T032 [P] [US2] Write `docs/scripts/validate-ai-context-schemas.md` — all 8 required sections; list the 5 required artifacts — docs/scripts/validate-ai-context-schemas.md
- [x] T033 [P] [US2] Write `docs/scripts/maintenance-cache-clean.md` — all 8 required sections; list CACHE_DIRS — docs/scripts/maintenance-cache-clean.md
- [x] T034 [P] [US2] Write `docs/scripts/seed-dashboard-test-data.md` — all 8 required sections; note DATABASE_URL infra-dependency and structured logging via createLogger — docs/scripts/seed-dashboard-test-data.md
- [x] T035 [P] [US2] Write `docs/scripts/validate-runtime-scripts.md` — all 8 required sections; note exit-1 hard-block behavior, scan regex, exclusion list — docs/scripts/validate-runtime-scripts.md
- [x] T036 [P] [US2] Write `docs/scripts/generate-script-docs.md` — all 8 required sections; document metadata header format, naming convention validation, legacy allowlist — docs/scripts/generate-script-docs.md

#### Documentation Generator

- [x] T037 [US2] Create `scripts/generate/script-docs.ts` — JSDoc metadata header, `createLogger('generate-script-docs')`, correlationId; walks `scripts/**/*.ts` excluding `__tests__/`; parses `@script`, `@domain`, `@description`, `@mode`, `@dependencies` JSDoc tags; validates each `@script` key against `DOMAIN_ACTION_RE` + legacy allowlist; writes `docs/scripts/<script-key-with-dashes>.md` per recovered script; writes `docs/scripts/SCRIPT_REGISTRY.md`; exits 1 on naming violation — scripts/generate/script-docs.ts
- [x] T038 [US2] Register `generate-script-docs` in root `package.json` scripts block: `"generate-script-docs": "bun run scripts/generate/script-docs.ts"` — package.json
- [x] T039 [US2] Execute `bun run dev:generate:script-docs` → verify it exits 0 and overwrites `docs/scripts/` pages matching the hand-authored versions from T027–T036

---

## Final Phase — Polish, Governance & Validation

### Tasks

- [x] T040 Add `## Script Governance` section to `AGENTS.md` after `## Migration Rules` — contains the 6 governance rules from plan.md §T010 including forward-only canonical path requirement, deduplication rule, metadata header requirement, naming convention, and validate-runtime-scripts gate — AGENTS.md
- [x] T041 Update `docs/scripts/SCRIPT_REGISTRY.md` to post-fix status — run `bun run scripts/validate/diff-script-registry.ts` and apply final state (MISSING → RECONSTRUCTED, DUPLICATE → CANONICAL, UNREGISTERED → REGISTERED, ALIAS-NEEDED → REGISTERED) — docs/scripts/SCRIPT_REGISTRY.md
- [x] T042 Execute T007 validation run — invoke each new/recovered script via `bun run <script>` from repo root, record exit code, stdout/stderr structured log output, and classification (PASS / PASS-INFRA-DEPENDENT / FAIL) for: `db:pool-status`, `db:validate-licenses`, `db:migrate`, `db:console`, `validate:ai-context-fresh`, `validate:ai-context-schemas`, `maintenance:cache-clean`, `seed-dashboard-test-data`, `validate-runtime-scripts`, `generate-script-docs` — (execution only, no file)
- [x] T043 Write `audits/runtime-script-validation.md` — validation report with date, executor, and per-row results table (Script | Exit Code | Output Excerpt | Classification) from T042 execution — specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/runtime-script-validation.md
- [x] T044 Execute `bun run validate:runtime:scripts` from repo root → confirm exit 0 (zero unregistered spec references); if exit 1, identify missing registrations and add them in root `package.json` before proceeding — package.json (if remediation needed)
- [x] T045 Run `bun run typecheck` → confirm zero TypeScript errors across all new script files — (validation only)
- [x] T046 Run `bun run lint` → confirm zero Biome violations across all new script files — (validation only)

---

## Dependency Graph

```
Phase 1 (T001–T002)
  └─→ Phase 2 (T003–T007)
        ├─→ Phase 3 / US1 (T008–T021)
        │     ├─→ Phase 4 / US3 (T022–T025)
        │     └─→ Phase 5 / US2 (T026–T039)
        └─→ Final Phase (T040–T046)
```

**Blocking dependencies:**

- T003–T005 must complete before T006–T007 (tools before execution)
- T006–T007 must complete before Phase 3 begins (scan before reconstruction)
- T008–T011 (seed dedup) must complete sequentially (compare → move → delete × 2)
- T019–T021 (package.json registration) must complete before T044 (CI guard validation)
- T022 must complete before T023 and T024 (impl before registration and tests)
- T025 must complete before Final Phase (tests must pass before polish)
- T026 must complete before T027–T036 (README before individual pages)
- T037 must complete before T038–T039 (generator before execution)
- T040–T043 must complete before T044–T046 (governance before final validation)

**Parallel opportunities within Phase 3 / US1:**

- T012, T013, T015, T016, T017, T018 share no file dependencies and may be implemented concurrently
- T019, T020, T021 are sequential edits to the same file (package.json), apply in one pass

**Parallel opportunities within Phase 5 / US2:**

- T027 through T036 (individual doc pages) are fully independent and may be written concurrently

---

## Implementation Strategy

**MVP scope (minimum viable pass):** Complete Phase 1 → Phase 2 → Phase 3 US1 through T021
(scripts exist and are registered). This alone resolves the primary developer experience failures
(commands found vs. "not found") and satisfies Scenarios 1, 4, and 5.

**Increment 2:** Complete Phase 4 US3 (CI guard + unit tests). This ensures no future regression.

**Increment 3:** Complete Phase 5 US2 (documentation + generator). This satisfies Scenario 2 and
the automated doc sync success criterion.

**Complete:** Final Phase (governance + validation report). Stage closure requires T040–T046 to pass.

---

## Format Validation

All 46 tasks follow the mandatory checklist format:

    - [X] T001 [P] [US1] Description — exact/file/path.ts

- ✅ All tasks start with `- [ ]`
- ✅ All tasks have sequential T-prefixed IDs in execution order
- ✅ `[P]` present only on tasks that are genuinely parallelizable (different files, no shared state)
- ✅ `[USN]` labels present on all Phase 3–5 tasks; absent on Setup, Foundational, and Polish tasks
- ✅ Every task includes a specific file path or artifact path
- ✅ No implementation body code in task descriptions
