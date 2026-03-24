# Research: STAGE FIX 03 — Build, Test, and Repository Cleanliness Enforcement

**Generated**: 2026-03-24
**Stage**: STAGE_FIX_03
**Mode**: Phase 0 — All NEEDS CLARIFICATION resolved

---

## 1. Policy Engine — Current State (INFRA-29)

### Decision

The Policy Engine skeleton exists and is partially wired. All three files in
`scripts/policy-engine/` are confirmed present and operational:

| File          | Status | Gap                                                                                                                                     |
| ------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`    | Exists | Missing `domain`, `violatingPaths`, `messages[]`, `deferralReport?` on interfaces                                                       |
| `registry.ts` | Exists | Contains only a `dummy` rule; no real rules registered                                                                                  |
| `runner.ts`   | Exists | Reads `--changed`/`--full` from argv, exits non-zero on error-severity; missing structured JSON output, correlation ID, GitNexus wiring |

### Current `PolicyContext` (types.ts)

```ts
export interface PolicyContext {
  mode: "full" | "changed";
}
```

**Missing**: `changedFiles: string[]`, `impactedModules: string[]`, `workspaceRoot: string`,
`correlationId: string`.

### Current `PolicyResult` (types.ts)

```ts
export interface PolicyResult {
  ruleId: string;
  success: boolean;
  severity: "error" | "warning";
  message?: string;
}
```

**Missing**: `domain: string`, `violatingPaths?: string[]`, `messages?: string[]`,
`deferralReport?: DeferralReport`.

### Current `PolicyRule` (types.ts)

```ts
export interface PolicyRule {
  id: string;
  run(context: PolicyContext): Promise<PolicyResult>;
}
```

**Missing**: `domain: string`, `severity: 'error' | 'warning'` on the rule definition itself
(needed for registry metadata and runner ordering logic).

### Rationale

The skeleton is intentionally minimal (placeholder until this stage). All additions are additive
(no breaking changes to existing callers since only the `dummy` rule exists).

### Alternatives considered

Wrapping with a new file instead of extending types.ts — rejected; direct extension keeps the
single source of truth.

---

## 2. `validate:policy` Entry Point — Current Implementation

### Decision

The command exists at `package.json:116`:

```json
"validate:policy": "bun run scripts/policy-engine/runner.ts"
```

The runner reads `process.argv` directly, so `bun run validate:policy -- --changed` and
`bun run validate:policy -- --full` both work today (args are forwarded by `bun run`).

### Gaps identified

- **No GitNexus context loading** in `--changed` mode; the runner simply passes `{ mode: 'changed' }` to rules with no file list.
- **No structured JSON stdout** per the Zidney error contract.
- **No correlation ID** generation.
- **No hard-fail guard** if the policy engine module fails to import.
- **No import chain guard** — if any rule throws at import time, the process crashes with an unformatted Node stack trace.

### Rationale

The runner needs targeted enhancement, not a rewrite. The arg-parsing logic is correct; only
output formatting and context enrichment are missing.

---

## 3. `scripts/security/` and `scripts/infra/` — Existing Scripts

### `scripts/security/` — confirmed contents

| File              | Purpose                                     |
| ----------------- | ------------------------------------------- |
| `scan.ts`         | Main security scan orchestrator             |
| `scan-ci.ts`      | CI-specific Trivy scan runner               |
| `scan-config.ts`  | Trivy configuration loader                  |
| `scan-deps.ts`    | Dependency vulnerability scan               |
| `scan-secrets.ts` | Secret detection scan (staged files or all) |
| `trivy-config.ts` | Trivy CLI type definitions                  |

**Relevance to FIX-03**: These scripts are Trivy-based security scanners already wired to
`infra:security:deps` and `infra:security:secrets` commands. They are NOT policy rules and do
NOT need migration. `RULE_FIX_03_ENVIRONMENT_READY` will call `scripts/verify-test-env.sh`
via subprocess, not these security scripts.

### `scripts/infra/` — EMPTY

No scripts exist here. New policy rule implementations for FIX-03 will live in
`scripts/policy-engine/rules/fix-03/`, not in `scripts/infra/`.

---

## 4. CI Workflows — Build/Test Invocation Audit

### Confirmed CI workflows

```
.github/workflows/ci.yml                   ← primary (all jobs)
.github/workflows/ai-context-validation.yml
.github/workflows/ci-type-safety.yml
.github/workflows/architecture-governance.yml
.github/workflows/hard-mode-guard.yml
```

### Direct `bun run build` / `bun run test` calls in `ci.yml` (target for migration)

| Line | Job                   | Command                                                          |
| ---- | --------------------- | ---------------------------------------------------------------- |
| 69   | `lint`                | `bun run build:packages` (lightweight build — prerequisite only) |
| 109  | `typecheck`           | `bun run build:packages` (lightweight build — prerequisite only) |
| 304  | `unit-tests`          | `bun run test:unit`                                              |
| 307  | `unit-tests`          | `bun run test:unit:boundaries`                                   |
| 415  | `integration-tests`   | `bun run test:integration`                                       |
| 501  | `coverage-validation` | `bun run test:unit --coverage`                                   |
| 704  | `build-verification`  | `bun run build` ← **primary target**                             |

**Note on `bun run build:packages`**: This is a prerequisite step inside `lint` and `typecheck`
jobs to build shared packages before checking consumers. It is NOT a standalone build invocation
and is NOT in scope for migration (it is infrastructure setup, not a validation call).

### Migration scope (FIX-03)

The `build-verification` job (line 704: `bun run build`) is the primary migration target.
Per FR-008, CI must replace all direct `build` and `test` invocations with
`bun run validate:policy --full`. However, the CI is structured with parallelized jobs (lint,
typecheck, unit-tests, integration-tests, coverage-validation, build-verification), not a single
sequential run. The migration approach in Phase 1 is a **new `policy-gate` job** that calls
`validate:policy --full` after all prerequisite jobs pass, replacing the `build-verification` job
directly and documenting that test jobs remain parallel (policy gate wraps them).

---

## 5. `repo:assert-clean` Script Status

### Decision

`repo:assert-clean` does **NOT exist** in `package.json` or anywhere in `scripts/`. It must be
created from scratch.

```json
// Current package.json — confirmed absent:
// "repo:assert-clean"   → NOT FOUND
// "repo:detect-artifacts" → NOT FOUND
// "repo:hash-build"     → NOT FOUND
// "repo:snapshot"       → NOT FOUND
// "validate:runtime-env" → NOT FOUND
```

The related `repo:doctor` (line 73) runs `scripts/dev/repo-doctor.ts` which checks lockfile
sync, dependency health, and README governance — it is NOT a git working-tree cleanliness check.

### Rationale

All four supporting scripts (`repo:assert-clean`, `repo:detect-artifacts`, `repo:hash-build`,
`validate:runtime-env`) are net-new. They will be implemented as TypeScript scripts under
`scripts/validate/` and registered in `package.json`.

---

## 6. `scripts/init-test-db.sh` — Current Behavior

### Decision

Script is functional and well-implemented. It is idempotent and wires directly into
`RULE_FIX_03_TEST_ISOLATION` without modification.

**What it does**:

1. Drops and recreates `zidney_master_test` database (idempotent)
2. Creates `workspaces`, `licenses`, `audit_logs` tables with indexes using `CREATE TABLE IF NOT EXISTS`
3. Sets schema version via a sentinel row in `workspaces`

**Env vars consumed**: `DB_HOST` (default: `localhost`), `DB_PORT` (default: `5432`),
`DB_USER` (default: `zidney_test`), `DB_PASSWORD` (default: `zidney_test`),
`MASTER_DB_NAME` (default: `zidney_master_test`)

**Idempotency**: Confirmed — `DROP DATABASE IF EXISTS` + `CREATE ... IF NOT EXISTS` +
`INSERT ... ON CONFLICT DO NOTHING` pattern.

**FIX-03 wiring**: `RULE_FIX_03_TEST_ISOLATION` invokes this script via `Bun.spawnSync` or
`execFileSync` before the test suite runs. The rule checks the exit code for success/failure.

---

## 7. `scripts/reset-test-redis.sh` — Current Behavior

### Decision

Script is functional and suitable for direct wiring into `RULE_FIX_03_TEST_ISOLATION` without
modification.

**What it does**:

1. Checks Redis connectivity on `$REDIS_HOST:$REDIS_PORT` (default: `localhost:6380`)
2. Runs `FLUSHALL` to clear all keys
3. Exits non-zero if Redis is unreachable

**Env vars consumed**: `REDIS_HOST` (default: `localhost`), `REDIS_PORT` (default: `6380`)

**Note**: CI Redis service (ci.yml integration-tests) is on port `6379`, not `6380`. The rule
must pass the correct `REDIS_PORT` env var when invoking the script in CI context (already
handled by the `TEST_REDIS_URL` env in the CI job).

**Idempotency**: Confirmed — `FLUSHALL` is idempotent; repeated invocations produce identical
clean state.

---

## 8. `scripts/verify-test-env.sh` — Current State and Gaps

### Decision

Script exists and is functional but has two gaps for `RULE_FIX_03_ENVIRONMENT_READY`:

1. **Port mismatch**: Checks PostgreSQL on `5433`, Redis on `6380`. CI services use `5432` and
   `6379`. The rule must pass env-overrideable ports.
2. **No Bun version check**: Script checks Node.js >= 20 but not Bun version (NFC-007 requires
   Bun runtime version verification).
3. **No JSON output**: Script produces human-readable stdout; `RULE_FIX_03_ENVIRONMENT_READY`
   needs machine-readable failure details.

### Rationale

`validate:runtime-env` script will wrap `verify-test-env.sh` logic in a TypeScript script that:

- Checks PostgreSQL + Redis with env-overrideable ports
- Verifies Bun version via `Bun.version`
- Verifies Node.js >= 20
- Outputs structured JSON errors on failure conforming to the Zidney error contract

---

## 9. GitNexus `--changed` Mode Integration

### Decision

`bun run arch:gitnexus:context` generates `docs/ai/context/gitnexus-context.json` with shape:

```ts
interface GitNexusContext {
  changedFiles: string[]; // git-diffed file paths
  impactedModules: string[]; // derived from dependency graph
  dependencyGraph: Record<string, string[]>;
  architectureLayerMap: Record<string, string>;
  riskIndicators: RiskIndicator[];
}
```

In `--changed` mode, the runner must:

1. Invoke `bun run arch:gitnexus:context` (or read the cached artifact if fresher than the current
   git HEAD) to populate `PolicyContext.changedFiles` and `PolicyContext.impactedModules`.
2. Pass these to every rule. Rules that support `--changed` mode use `changedFiles` to scope
   their checks. Rules that don't support scoping run unconditionally.

### Alternatives considered

Reading the JSON artifact directly without re-running the generator — acceptable when the artifact
was generated in the same process (e.g., pre-push hook runs the context generator before the
policy runner). The runner will check artifact freshness (file mtime vs. current git HEAD commit
time) and regenerate if stale.

---

## 10. Artifact Allowlist — Confirmed Boundaries

### Decision

Approved generated artifact paths (FR-011):

- `docs/ai/context/**` — AI context artifacts (regenerated by `arch:gitnexus:context`, `ai:context:refresh`)
- `docs/architecture/intelligence/**` — Architecture intelligence artifacts (regenerated by `infra-audit.ts`)
- `dist/**` — Build output, only if explicitly tracked by git (`git ls-files dist/`)

Prohibited detected paths (targets for `RULE_FIX_03_NO_ARTIFACT_DRIFT`):

- `coverage/**`
- `.tmp/**`
- `tmp/**`
- `**/.output/**`
- `**/playwright-report/**`
- `**/test-results/**`
- `**/test-perf-output/**`
- `**/test-perf-output-2/**`

Note: `test-perf-output/` and `test-perf-output-2/` exist in the workspace root and appear to
be pre-existing artifact directories; these will be in the prohibited list unless explicitly
added to `.gitignore` and the allowlist.

---

## 11. Error Contract — Confirmed Format

All policy rule failures conform to the Zidney error contract (from spec clarifications):

```ts
interface ZidneyResponse<T = null> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}
```

Policy runner stdout (on failure of each rule):

```json
{
  "success": false,
  "data": {
    "ruleId": "RULE_FIX_03_ENVIRONMENT_READY",
    "domain": "infra",
    "severity": "error",
    "correlationId": "fix03-<timestamp>-<random>",
    "violatingPaths": [],
    "messages": ["PostgreSQL unreachable on localhost:5432"]
  },
  "error": {
    "code": "RULE_FIX_03_ENVIRONMENT_READY",
    "message": "Required runtime environment is not ready"
  }
}
```

---

## 12. Husky Hooks — Migration Impact

### Pre-push (`pre-push`)

Currently calls (in order):

1. `bun scripts/ai-guard.ts` — architecture governance (blocking)
2. `bun scripts/infra-audit.ts --quick` — infra audit (blocking)
3. `bun scripts/governance/validate-architecture-brain.ts` — brain validation (blocking)
4. `bun run test:unit` — unit tests (NON-blocking — exits 0 regardless)
5. TypeScript validation — blocking for TS files
6. `actionlint` — workflow validation (optional if installed)

**Migration per FR-009**: Replace steps 4 (unit tests) and 5 (typecheck — already done by
`RULE_FIX_03_AUTO_FIX_ATTEMPT`) with a single call to `bun run validate:policy -- --changed`.
Architecture governance steps 1–3 remain (they are separate from the policy engine).

### Pre-commit (`pre-commit`)

Currently calls lint-staged, tsc, arch guard, brain validation, trivy. Does NOT call
`validate:policy`. No migration required for pre-commit (FR-009 targets pre-push only).

---

## Summary of All NEEDS CLARIFICATION — Resolved

| Unknown                                         | Resolution                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| Policy engine rules that already exist          | Only `dummy` rule; no real rules implemented                             |
| `validate:policy` current implementation        | Exists, skeleton only; missing JSON output and GitNexus wiring           |
| `scripts/security/` contents                    | Trivy-based scanners; not policy rules; no migration needed              |
| `scripts/infra/` contents                       | Empty; new policy rule files go in `scripts/policy-engine/rules/fix-03/` |
| CI workflows with direct `bun run build`/`test` | `build-verification` job line 704; test jobs 304, 307, 415, 501          |
| `repo:assert-clean` status                      | Does NOT exist; must be created from scratch                             |
| `scripts/init-test-db.sh` behavior              | Functional, idempotent; wire directly into `RULE_FIX_03_TEST_ISOLATION`  |
| `scripts/reset-test-redis.sh` behavior          | Functional, idempotent; wire directly into `RULE_FIX_03_TEST_ISOLATION`  |
| `validate:runtime-env` status                   | Does NOT exist; wrap `verify-test-env.sh` logic in new TS script         |
| GitNexus `--changed` mode                       | Read `gitnexus-context.json` artifact; regenerate if stale               |
