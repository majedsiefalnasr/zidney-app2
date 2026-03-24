# Implementation Plan: STAGE FIX 03 — Build, Test, and Repository Cleanliness Enforcement

**Generated**: 2026-03-24
**Stage**: STAGE_FIX_03
**Branch**: `spec/fix-03-build-test-and-repository-cleanliness-enforcement`
**Research**: `research.md` (all NEEDS CLARIFICATION resolved)
**Risk**: MEDIUM
**Migration requirements**: None (infra-only stage; no DB schema changes)

---

## Stage Alignment

- **Phase**: 0X_FIXES
- **Stage**: STAGE_FIX_03 — Build, Test, and Repository Cleanliness Enforcement
- **Related Spec File**: `specs/phases/0X_FIXES/STAGE_FIX_03_BUILD_TEST_AND_REPOSITORY_CLEANLINESS_ENFORCEMENT.md`
- **Related ADR**: None required — all modules are within the `scripts/` infra layer, which does not require ADR registration.
- **Enabling Spec**: INFRA-29 (`specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_29_POLICY_ENGINE_AND_GOVERNANCE_RULES_LAYER.md`) — scope confinement authority for the policy engine pattern.

Plan operates entirely within the `scripts/` infra tooling layer. No modules outside this layer are introduced.

---

## Architectural Scope Confirmation

- ✅ No cross-tenant data access — infra tooling stage only; no data queries
- ✅ No middleware bypass — API routing layer is untouched; no `apps/api/*` changes
- ✅ No direct DB instantiation — test isolation rules invoke existing `scripts/init-test-db.sh` and `scripts/reset-test-redis.sh` via subprocess; no Drizzle/Postgres client instantiated directly
- ✅ No grading logic outside Worker — no attempt engine or grading domain code modified
- ✅ Snapshot integrity preserved — no changes to `packages/domain-core` or `apps/api/src/db`
- ✅ Version enforcement preserved — no changes to version middleware or seed data
- ✅ No layer boundary violations — all new modules are `scripts/policy-engine/rules/fix-03/**` and `scripts/validate/**` (infra tooling, not `apps/*` or `packages/*`)

---

## Implementation Layers

## Implementation Layers

### CLI / Scripts Layer (primary scope)

**Entry point**: `scripts/policy-engine/runner.ts`

- CLI flags: `--changed`, `--full`
- `--changed`: loads GitNexus context artifact, populates `PolicyContext.changedFiles` and `PolicyContext.impactedModules`; if no changed files → exits 0 immediately with no-op summary
- `--full`: no filtering; passes empty `changedFiles` and `impactedModules` to all rules
- No `--rule=X` single-rule flag is in scope for this stage (SC-008 "individually invokable" refers to direct test invocation, not a CLI flag)
- Generates `correlationId = "fix03-<timestamp>-<random>"`
- Stdout on every rule completion: one JSON line per rule (structured output)
- Final stdout: `{ success: boolean, data: { summary }, error: null | { code, message } }`
- Exit codes:
  - `0` — all rules passed or only `warning`-severity violations (with `DeferralReport` for each warning)
  - `1` — at least one `error`-severity rule violation
  - `2` — environment/infrastructure error (policy engine module import failure, GitNexus artifact unreadable, uncaught exception in runner infrastructure)

**Error contract serialization** (`PolicyResult` → wire format):

```ts
// On pass:
{ success: true, data: { ruleId, domain, severity: 'warning'|undefined, messages: [], violatingPaths: [], deferralReport: undefined }, error: null }

// On error-severity failure:
{ success: false, data: { ruleId, domain, severity: 'error', messages: [...], violatingPaths: [...], deferralReport: null }, error: { code: ruleId, message: messages[0] } }

// On warning-severity (non-blocking):
{ success: true, data: { ruleId, domain, severity: 'warning', messages: [...], violatingPaths: [...], deferralReport: { ruleId, reason, followUpStage } }, error: null }
```

`PolicyResult.passed` invariant: `passed = true` iff `severity !== 'error'`. A result with `severity: 'error'` MUST have `passed: false`. A result with `severity: 'warning'` MUST have `passed: true` (warnings do not block).

**Type extension** (`scripts/policy-engine/types.ts`):

```ts
// Extended PolicyContext
interface PolicyContext {
  mode: "full" | "changed";
  changedFiles: string[]; // [] in --full mode
  impactedModules: string[]; // [] in --full mode
  workspaceRoot: string; // process.cwd()
  correlationId: string;
  autoFixedPaths: string[]; // populated by RULE_FIX_03_AUTO_FIX_ATTEMPT; REPO_CLEAN skips these paths
}

// Extended PolicyResult
interface PolicyResult {
  ruleId: string;
  domain: string;
  passed: boolean; // true iff severity !== 'error'
  severity: "error" | "warning";
  messages: string[];
  violatingPaths: string[];
  deferralReport?: DeferralReport;
}

// Extended PolicyRule
interface PolicyRule {
  id: string;
  domain: string;
  severity: "error" | "warning";
  run(context: PolicyContext): Promise<PolicyResult>;
}

// ArtifactSnapshot — point-in-time repo state for drift detection
interface ArtifactSnapshot {
  timestamp: string; // ISO-8601
  baseRef: string; // git HEAD SHA at snapshot time
  trackedFiles: string[]; // output of `git ls-files`
  untrackedFiles: string[]; // files in prohibited dirs per `git status --short`
  prohibitedPaths: string[]; // paths matching the blocklist at snapshot time
}

// DeferralReport — structured non-blocking failure record
interface DeferralReport {
  ruleId: string;
  reason: string;
  followUpStage: string; // e.g. "STAGE_FIX_04_..." or "manual remediation"
}
```

**API Layer**: N/A — no HTTP routes, no Hono changes, no middleware registration.

**Worker Layer**: N/A — no background jobs introduced.

**Frontend Layer**: N/A — no UI changes.

**MMC / Backoffice**: N/A — no commercial authority changes.

---

## Rule Implementation Plan

Nine rules to implement in execution order, all in `scripts/policy-engine/rules/fix-03/`:

| Order | Rule ID                          | File                    | Severity | `--changed` scoped? |
| ----- | -------------------------------- | ----------------------- | -------- | ------------------- |
| 1     | `RULE_FIX_03_ENVIRONMENT_READY`  | `environment-ready.ts`  | error    | No (always runs)    |
| 2     | `RULE_FIX_03_AUTO_FIX_ATTEMPT`   | `auto-fix-attempt.ts`   | warning  | Yes                 |
| 3     | `RULE_FIX_03_BUILD_PASS`         | `build-pass.ts`         | error    | Yes                 |
| 4     | `RULE_FIX_03_TEST_PASS`          | `test-pass.ts`          | error    | Yes                 |
| 5     | `RULE_FIX_03_TEST_ISOLATION`     | `test-isolation.ts`     | error    | No (always runs)    |
| 6     | `RULE_FIX_03_REPO_CLEAN`         | `repo-clean.ts`         | error    | No (always runs)    |
| 7     | `RULE_FIX_03_NO_ARTIFACT_DRIFT`  | `no-artifact-drift.ts`  | error    | No (always runs)    |
| 8     | `RULE_FIX_03_ARTIFACT_ALLOWLIST` | `artifact-allowlist.ts` | error    | No (always runs)    |
| 9     | `RULE_FIX_03_COVERAGE_THRESHOLD` | `coverage-threshold.ts` | warning  | No (`--full` only)  |

`RULE_FIX_03_FLAKY_TEST_DETECTION` is deferred to a follow-up stage (test infra work not in scope here).

**Rule details**:

1. **`RULE_FIX_03_ENVIRONMENT_READY`**: Invokes `scripts/validate/validate-runtime-env.ts` via subprocess. Checks PostgreSQL + Redis reachability (env-overrideable ports), Bun version, Node >= 20. Returns structured JSON errors on failure. Exits the entire runner immediately if this rule fails (no subsequent rules run).

2. **`RULE_FIX_03_AUTO_FIX_ATTEMPT`**: Runs `bun run lint:fix && bun run format` on scoped files (from `changedFiles` in `--changed` mode; all files in `--full`). Re-runs `bun run typecheck`. Populates `PolicyContext.autoFixedPaths` with all files it modifies. If auto-fix resolves all issues, emits `warning`-severity with deferral note. If issues remain after fix attempt (typecheck still fails), emits `error`.

3. **`RULE_FIX_03_BUILD_PASS`**: Invokes `bun run build` (scoped to impacted workspaces in `--changed` mode). Reports failing package names in `violatingPaths`.

4. **`RULE_FIX_03_TEST_PASS`**: Invokes `bun run test:unit` (or scoped `vitest run --project <workspace>` in `--changed` mode). Reports failing test files in `violatingPaths` and failing test names in `messages`.

5. **`RULE_FIX_03_TEST_ISOLATION`**: Invokes `scripts/init-test-db.sh` and `scripts/reset-test-redis.sh` via subprocess. Confirms clean state (idempotent). Fails if either exits non-zero.

6. **`RULE_FIX_03_REPO_CLEAN`**: Runs `bun run repo:assert-clean`. Checks working tree for uncommitted files outside the artifact allowlist. Excludes any paths present in `PolicyContext.autoFixedPaths` (set by `AUTO_FIX_ATTEMPT`) so that automatically-fixed source files do not trigger a false dirty-tree violation. Reports remaining violating paths.

7. **`RULE_FIX_03_NO_ARTIFACT_DRIFT`**: Uses `ArtifactSnapshot` — compares current `git status` against tracked state. Reports any files that appeared in prohibited directories since rule execution began.

8. **`RULE_FIX_03_ARTIFACT_ALLOWLIST`**: Runs `bun run repo:detect-artifacts`. Scans for any files in `coverage/**`, `.tmp/**`, `tmp/**`, `**/.output/**`, `**/playwright-report/**`, `**/test-results/**`, `**/test-perf-output/**`, `**/test-perf-output-2/**`. Reports each match in `violatingPaths`.

9. **`RULE_FIX_03_COVERAGE_THRESHOLD`**: Invokes `bun run test:unit --coverage` in `--full` mode only. Parses coverage JSON. Global threshold >= 70%, critical modules threshold >= 80%. Emits `warning` (not `error`) on breach with threshold details in `messages`.

---

## Supporting Scripts Plan

Four new scripts in `scripts/validate/`:

| Script                                      | Package.json entry      | Purpose                                                         |
| ------------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| `scripts/validate/validate-runtime-env.ts`  | `validate:runtime-env`  | Env readiness — PG, Redis, Bun version, Node >= 20; JSON output |
| `scripts/validate/repo-assert-clean.ts`     | `repo:assert-clean`     | Git working-tree cleanliness gate; idempotent                   |
| `scripts/validate/repo-detect-artifacts.ts` | `repo:detect-artifacts` | Scans for prohibited artifact paths                             |
| `scripts/validate/repo-hash-build.ts`       | `repo:hash-build`       | Snapshots `dist/**` hashes for drift comparison                 |

All supporting scripts:

- Exit 0 on pass, non-zero on failure
- Output structured JSON to stdout on failure (`{ success, data, error }`)
- Are idempotent

---

## Package.json Script Entries

Five new/verified scripts in root `package.json`:

```json
"validate:policy": "bun run scripts/policy-engine/runner.ts",
"validate:runtime-env": "bun run scripts/validate/validate-runtime-env.ts",
"repo:assert-clean": "bun run scripts/validate/repo-assert-clean.ts",
"repo:detect-artifacts": "bun run scripts/validate/repo-detect-artifacts.ts",
"repo:hash-build": "bun run scripts/validate/repo-hash-build.ts"
```

(`validate:policy` already exists at line 116 and will be verified, not duplicated.)

---

## CI Workflow Migration

**File**: `.github/workflows/ci.yml`

**Change**: Replace `build-verification` job (line 704: `bun run build`) with a new `policy-gate` job:

```yaml
policy-gate:
  name: Policy Gate
  runs-on: ubuntu-latest
  needs: [lint, typecheck, unit-tests, integration-tests, coverage-validation]
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
    - run: bun install --frozen-lockfile
    - run: bun run validate:policy --full
```

Update `ci-success.needs` (line 724) to reference `policy-gate` instead of `build-verification`.

Direct `bun run test:unit`, `bun run test:unit:boundaries`, `bun run test:integration`, and `bun run test:unit --coverage` invocations in test jobs remain as prerequisites for `policy-gate`.

---

## Husky Pre-Push Hook Migration

**File**: `.husky/pre-push`

Replace step 4 (direct `bun run test:unit`) and step 5 (standalone `tsc` check) with:

```bash
bun run validate:policy -- --changed
```

Architecture governance steps (ai-guard, infra-audit, validate-architecture-brain) remain unchanged before this new step.

---

## Database Impact

- **Master DB**: No tables touched. No migration required.
- **Tenant DB**: No tables touched. No migration required.
- Infra-only stage. STAGE_02C_MIGRATION_AND_VERSIONING_MODEL is not impacted.

---

## Transaction Design

No mutating DB operations in this stage. `scripts/init-test-db.sh` uses PostgreSQL-level transactions internally (handled by existing script). No transaction design required.

---

## Idempotency Plan

All supporting scripts are idempotent by design:

- `repo:assert-clean` — reads `git status --porcelain` (read-only)
- `repo:detect-artifacts` — scans filesystem paths (read-only)
- `repo:hash-build` — hashes `dist/**` (read-only)
- `validate:runtime-env` — probes service ports (read-only)

No idempotency keys or worker deduplication required.

---

## Version Enforcement Strategy

- `RULE_FIX_03_ENVIRONMENT_READY` checks Bun version via `Bun.version` against `engines` field minimum in `package.json`
- Node.js >= 20 verified
- Package versions governed by `bun install --frozen-lockfile` in CI
- No `schema_version` or `product_version` concerns

---

## Authoritative Time Handling

No time-authority concerns. Rule execution `correlationId` uses `Date.now()` for timestamp component only — not for business logic.

---

## Observability & Logging

All rule outputs use structured JSON stdout conforming to `{ success, data, error }`. Each rule emits one JSON line per result. The runner aggregates results into a final summary JSON object. No `console.log` with plain strings in production code paths. `correlationId` is generated per runner invocation and included in each rule result.

---

## Rate Limiting

Not applicable — CLI tooling invoked locally or in CI, not an HTTP endpoint.

---

## Failure Modes

| Failure                             | Rule                             | Recovery                                                                              |
| ----------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| PostgreSQL unreachable              | `RULE_FIX_03_ENVIRONMENT_READY`  | Hard fail exit 1; start DB then re-run                                                |
| Redis unreachable                   | `RULE_FIX_03_ENVIRONMENT_READY`  | Hard fail exit 1; start Redis then re-run                                             |
| Bun version mismatch                | `RULE_FIX_03_ENVIRONMENT_READY`  | Hard fail exit 1; upgrade Bun                                                         |
| Build failure                       | `RULE_FIX_03_BUILD_PASS`         | Reports failing package names; fix and re-run                                         |
| Unit test failures                  | `RULE_FIX_03_TEST_PASS`          | Reports failing test files in violatingPaths; fix and re-run                          |
| Test state leakage                  | `RULE_FIX_03_TEST_ISOLATION`     | Runner invokes init-test-db.sh and reset-test-redis.sh; fail if either exits non-zero |
| Prohibited artifacts detected       | `RULE_FIX_03_ARTIFACT_ALLOWLIST` | Reports each path; remove before re-running                                           |
| Coverage below threshold            | `RULE_FIX_03_COVERAGE_THRESHOLD` | Warning only; DeferralReport generated; stage not blocked                             |
| Policy engine module import failure | runner.ts hard-fail guard        | Exit 2; no soft fallback to direct build/test                                         |
| Uncaught exception in rule          | runner.ts catch                  | Treat as error-severity; structured crash report; exit 1                              |

---

## Security Review

- No RBAC changes — infra tool has no auth layer (NFC-008)
- No secrets logged — rule implementations must not log env vars
- No sensitive data in structured output — violatingPaths contains only file paths
- No JWT scope changes
- No outbound network calls except PG/Redis readiness probes

---

## Test Strategy

### Unit Tests (15 files in `tests/policy-engine/fix-03/`)

| Test File                                                          | Coverage                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `tests/policy-engine/fix-03/types.test.ts`                         | Interface type guards (`isPolicyResult`, `isDeferralReport`)                |
| `tests/policy-engine/fix-03/runner.test.ts`                        | Rule ordering, exit codes 0/1/2, correlationId, no-op on empty --changed    |
| `tests/policy-engine/fix-03/rules/environment-ready.test.ts`       | PG/Redis/Bun/Node checks; failure modes; JSON output shape                  |
| `tests/policy-engine/fix-03/rules/auto-fix-attempt.test.ts`        | Fix succeeds -> warning; fix fails -> error                                 |
| `tests/policy-engine/fix-03/rules/build-pass.test.ts`              | Clean pass; build failure; violatingPaths content                           |
| `tests/policy-engine/fix-03/rules/test-pass.test.ts`               | All pass; failing test names in messages; violatingPaths                    |
| `tests/policy-engine/fix-03/rules/test-isolation.test.ts`          | init-test-db.sh success; reset-test-redis.sh success; each failing          |
| `tests/policy-engine/fix-03/rules/repo-clean.test.ts`              | Clean tree passes; dirty tree fails; violatingPaths                         |
| `tests/policy-engine/fix-03/rules/no-artifact-drift.test.ts`       | Snapshot diff clean; drift detected in prohibited dirs                      |
| `tests/policy-engine/fix-03/rules/artifact-allowlist.test.ts`      | No prohibited files -> pass; coverage dir detected -> fail                  |
| `tests/policy-engine/fix-03/rules/coverage-threshold.test.ts`      | Above threshold -> pass; below global -> warning; below critical -> warning |
| `tests/policy-engine/fix-03/scripts/validate-runtime-env.test.ts`  | All env vars present -> pass; missing PG -> structured error                |
| `tests/policy-engine/fix-03/scripts/repo-assert-clean.test.ts`     | Clean tree -> exit 0; dirty -> exit 1 with paths                            |
| `tests/policy-engine/fix-03/scripts/repo-detect-artifacts.test.ts` | No prohibited files -> empty; coverage dir -> violatingPaths                |
| `tests/policy-engine/fix-03/registry.test.ts`                      | All 9 rules present; ID uniqueness; execution order contract                |

### Key Assertions

- Error contract shape on every failure: `{ success: false, data: {...}, error: { code: ruleId, message: string } }`
- Success-path stdout shape: `{ success: true, data: { ruleId, domain, messages: [], violatingPaths: [] }, error: null }`
- Exit code 0 when all rules pass or only warnings
- Exit code 1 when any error-severity violation
- Exit code 2 on infrastructure/runner import failure
- `PolicyResult.passed === true` iff `severity !== 'error'` — validated in runner.test.ts
- Idempotency: `repo:assert-clean` invoked twice on clean repo -> identical exit 0

### Test isolation config

All test files use `--pool=forks --isolate` (already in vitest.config.ts). No shared module state.

---

## Rollback Strategy

- No DB migrations -> no rollback complexity
- CI workflow: revert `.github/workflows/ci.yml` edit (restore `build-verification` job and update `ci-success.needs`)
- Husky hook: revert `.husky/pre-push` to restore direct `test:unit` and `tsc` calls
- `package.json` script additions are additive and safe to remove
- `scripts/policy-engine/rules/fix-03/*.ts` files can be deleted without impacting other rules
- `registry.ts` edits can be reverted to restore `dummy` rule only

---

## Non-Goals

- No `--rule=X` single-rule CLI flag in scope
- `RULE_FIX_03_FLAKY_TEST_DETECTION` — deferred to follow-up stage
- Coverage enforcement is `warning`-only (never `error`-severity)
- No changes to `apps/api/**`, `packages/**`, or any domain packages
- No new npm/bun packages required

---

## File Manifest (23 files)

| #     | Path                                                       | Action                                                                                                                                                                                                                                                                |
| ----- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `scripts/policy-engine/types.ts`                           | Modify — coordinated breaking type migration (files 1+2+3 updated atomically): removes `success`+`message`, adds `passed`+`messages[]`+`domain`+`violatingPaths`+`deferralReport`; adds `domain`+`severity` to `PolicyRule`; adds `autoFixedPaths` to `PolicyContext` |
| 2     | `scripts/policy-engine/runner.ts`                          | Modify — GitNexus wiring, structured output, correlationId, exit codes 0/1/2                                                                                                                                                                                          |
| 3     | `scripts/policy-engine/registry.ts`                        | Modify — register 9 new rules                                                                                                                                                                                                                                         |
| 4     | `scripts/policy-engine/rules/fix-03/environment-ready.ts`  | Create                                                                                                                                                                                                                                                                |
| 5     | `scripts/policy-engine/rules/fix-03/auto-fix-attempt.ts`   | Create                                                                                                                                                                                                                                                                |
| 6     | `scripts/policy-engine/rules/fix-03/build-pass.ts`         | Create                                                                                                                                                                                                                                                                |
| 7     | `scripts/policy-engine/rules/fix-03/test-pass.ts`          | Create                                                                                                                                                                                                                                                                |
| 8     | `scripts/policy-engine/rules/fix-03/test-isolation.ts`     | Create                                                                                                                                                                                                                                                                |
| 9     | `scripts/policy-engine/rules/fix-03/repo-clean.ts`         | Create                                                                                                                                                                                                                                                                |
| 10    | `scripts/policy-engine/rules/fix-03/no-artifact-drift.ts`  | Create                                                                                                                                                                                                                                                                |
| 11    | `scripts/policy-engine/rules/fix-03/artifact-allowlist.ts` | Create                                                                                                                                                                                                                                                                |
| 12    | `scripts/policy-engine/rules/fix-03/coverage-threshold.ts` | Create                                                                                                                                                                                                                                                                |
| 13    | `scripts/validate/validate-runtime-env.ts`                 | Create                                                                                                                                                                                                                                                                |
| 14    | `scripts/validate/repo-assert-clean.ts`                    | Create                                                                                                                                                                                                                                                                |
| 15    | `scripts/validate/repo-detect-artifacts.ts`                | Create                                                                                                                                                                                                                                                                |
| 16    | `scripts/validate/repo-hash-build.ts`                      | Create                                                                                                                                                                                                                                                                |
| 17    | `package.json`                                             | Modify — add 4 new script entries                                                                                                                                                                                                                                     |
| 18    | `.github/workflows/ci.yml`                                 | Modify — add policy-gate job, update ci-success.needs                                                                                                                                                                                                                 |
| 19    | `.husky/pre-push`                                          | Modify — replace step 4 & 5 with validate:policy --changed                                                                                                                                                                                                            |
| 20–34 | `tests/policy-engine/fix-03/**` (15 files)                 | Create — unit tests                                                                                                                                                                                                                                                   |

---

## Final Compliance Statement

Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.

- No cross-tenant data access
- No middleware bypass
- No architecture layer violations
- No DB migrations
- All new modules in `scripts/` layer (infra tooling)
- Error contract (`{ success, data, error }`) consistently applied
- Exit codes formalized (0 / 1 / 2)
- Type invariants (`passed <-> severity`) defined
- Test strategy covers all rule failure paths and interface contracts
