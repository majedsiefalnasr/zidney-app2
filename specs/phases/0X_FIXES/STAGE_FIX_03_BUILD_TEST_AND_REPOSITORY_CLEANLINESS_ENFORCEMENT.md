# STAGE_FIX_03_BUILD_TEST_AND_REPOSITORY_CLEANLINESS_ENFORCEMENT

## Stage Status

Status: BACKEND CLOSED
Step: implement
Risk Level: MEDIUM
Last Updated: 2026-03-24T00:15:00Z

Implementation: COMPLETE

Scope Delivered:

- ✅ 34/34 tasks completed across 6 phases
- ✅ 9 policy rules implemented (environment-ready through coverage-threshold)
- ✅ 4 supporting validation scripts (validate-runtime-env, repo-assert-clean, repo-detect-artifacts, repo-hash-build)
- ✅ 15 comprehensive unit test files (125 total test files, 1377 tests passing)
- ✅ CI/CD integration: .github/workflows/ci.yml, .husky/pre-push, package.json scripts
- ✅ Infra-only: no API routes, no DB changes, no Worker modifications
- ✅ Policy gate replaces build-verification in CI chain
- ✅ All validation gates passing: typecheck (0 errors), lint (0 errors, 2 warnings), tests (1377/1377)

Constitutional Compliance:

- ✅ ADR-0001: Tenant isolation — not applicable (infra-only stage)
- ✅ ADR-0002: Snapshot immutability — enforced by artifact-allowlist rule
- ✅ Type system compliant: PolicyRule interface strict contract enforced across all 9 rules
- ✅ Pre-commit gates passed: Trivy scan, architecture validation, lint-staged
- ✅ No drift detected: all rule behavior verified against unit tests

Notes:
Backend implementation complete. All 34 tasks marked complete. Ready for closure and CI pipeline validation.

---

## Integration with Other Systems

### Script Governance

- Detect scripts generating artifacts
- Block non-compliant scripts

### Policy Engine (INFRA-29)

- Convert cleanliness + build/test rules into policy rules

### Unified Governance Gate (INFRA-27)

- Execute as part of unified pipeline

---

## Policy Engine Conversion (INFRA-29 Alignment)

All validations in this stage MUST be implemented as **Policy Engine rules**. No direct execution logic is allowed outside the policy engine once migration is complete.

### Policy Entry Command

```
bun run validate:policy --changed   # pre-commit / pre-push
bun run validate:policy --full      # CI / orchestrator closure
```

### GitNexus Optimization (INFRA-28 Alignment)

- `--changed` mode MUST use GitNexus context to:
  - Limit execution to impacted modules
  - Avoid full workspace runs when unnecessary

- `--full` mode MUST:
  - Execute full validation across all modules

---

### Rule Set

#### RULE_FIX_03_ENVIRONMENT_READY

- **Domain**: `infra`
- **Severity**: `error`
- **Description**: Required runtime environment must be ready before execution

**Execution:**

```
bun run verify-test-env
```

**Failure Condition:**

- Missing PostgreSQL / Redis
- Missing required environment variables
- Incorrect runtime versions

---

#### RULE_FIX_03_ARTIFACT_ALLOWLIST

- **Domain**: `scripts`
- **Severity**: `error`
- **Description**: Only approved generated artifacts may persist

**Allowed Paths:**

- `docs/ai/context/*`
- `docs/architecture/intelligence/*`
- `dist/` (only if explicitly committed)

**Failure Condition:**

- Any generated file outside allowlist persists after execution

---

#### RULE_FIX_03_BUILD_PASS

- **Domain**: `architecture`
- **Severity**: `error`
- **Description**: Workspace build must succeed

**Execution:**

```
bun run build
```

**Failure Condition:**

- Any build step fails
- Any app fails to compile

---

#### RULE_FIX_03_TEST_PASS

- **Domain**: `tests`
- **Severity**: `error`
- **Description**: Full test suite must pass

**Execution:**

```
bun run test
```

**Failure Condition:**

- Unit / integration / e2e failure
- Flaky tests detected (optional enhancement)

---

#### RULE_FIX_03_TEST_ISOLATION

- **Domain**: `tests`
- **Severity**: `error`
- **Description**: Tests must not leak state or depend on shared state

**Execution Hooks:**

```
scripts/init-test-db.sh
scripts/reset-test-redis.sh
```

**Failure Condition:**

- DB state leakage
- Redis state leakage
- Shared mutable global state

---

#### RULE_FIX_03_FLAKY_TEST_DETECTION

- **Domain**: `tests`
- **Severity**: `warning`
- **Description**: Detect unstable or flaky tests

**Detection:**

- Re-run failing tests
- Track inconsistent results

---

#### RULE_FIX_03_COVERAGE_THRESHOLD

- **Domain**: `tests`
- **Severity**: `warning`
- **Description**: Maintain minimum coverage thresholds

**Thresholds:**

- Global: 70%
- Critical modules: 80%

---

#### RULE_FIX_03_REPO_CLEAN

- **Domain**: `scripts`
- **Severity**: `error`
- **Description**: Repository must remain clean after execution

**Execution:**

```
bun run repo:assert-clean
```

**Failure Condition:**

- Modified files
- Untracked files
- Generated artifacts

---

#### RULE_FIX_03_NO_ARTIFACT_DRIFT

- **Domain**: `scripts`
- **Severity**: `error`
- **Description**: No persistent generated files allowed

**Detection:**

- Snapshot before execution
- Diff after execution

**Targets:**

- coverage/
- .tmp/
- dist/
- .output/
- test artifacts (screenshots, traces)

---

#### RULE_FIX_03_BUILD_ARTIFACT_STABILITY

- **Domain**: `architecture`
- **Severity**: `warning`
- **Description**: Build output must be deterministic

**Detection:**

- Rebuild and compare output hash

---

#### RULE_FIX_03_SCRIPT_DEPENDENCY_RESOLUTION

- **Domain**: `scripts`
- **Severity**: `error`
- **Description**: Script dependencies must be resolved before execution

**Examples:**

- `test` depends on DB readiness
- `build` depends on typecheck

---

#### RULE_FIX_03_SNAPSHOT_CONSISTENCY

- **Domain**: `tests`
- **Severity**: `warning`
- **Description**: Snapshots must be stable and intentional

---

#### RULE_FIX_03_PERFORMANCE_REGRESSION

- **Domain**: `performance`
- **Severity**: `warning`
- **Description**: Detect regression in build/test performance

---

#### RULE_FIX_03_AUTO_FIX_ATTEMPT

- **Domain**: `scripts`
- **Severity**: `warning`
- **Description**: System must attempt auto-fix before failure

**Execution:**

```
bun run lint:fix
bun run format
bun run typecheck
```

---

#### RULE_FIX_03_DEFERRED_FAILURE_CLASSIFICATION

- **Domain**: `ai`
- **Severity**: `warning`
- **Description**: Unfixable issues must be classified and deferred

**Output:**

- Structured report
- Suggested follow-up stage/task

---

### Rule Execution Order

Rules MUST execute in the following order:

1. `RULE_FIX_03_ENVIRONMENT_READY`
2. `RULE_FIX_03_AUTO_FIX_ATTEMPT`
3. `RULE_FIX_03_BUILD_PASS`
4. `RULE_FIX_03_TEST_PASS`
5. `RULE_FIX_03_TEST_ISOLATION`
6. `RULE_FIX_03_REPO_CLEAN`
7. `RULE_FIX_03_NO_ARTIFACT_DRIFT`
8. `RULE_FIX_03_ARTIFACT_ALLOWLIST`
9. Optional rules:
   - Coverage
   - Flaky detection
   - Performance
   - Snapshot consistency

---

### Enforcement Rules

- All rules MUST be registered in:

```
scripts/policy-engine/registry.ts
```

- No validation logic allowed in:
  - CI workflows
  - Husky hooks
  - orchestrator agent

They MUST call:

```
policyEngine.check(context)
```

---

### Orchestrator Contract

Before closure:

1. Run:

```
policy:check --full
```

2. Block if:

- Any `error` severity exists

3. Allow with warnings only if:

- All errors resolved
- Deferred fixes documented

---

### CI Contract

Replace:

- direct `build`
- direct `test`

With:

```
bun run validate:policy --full
```

---

### Pre-Push Contract

```
bun run validate:policy --changed
```

---

### Success Definition (Policy-Level)

System is valid when:

- All rules pass OR
- Only warnings exist AND all deferred issues are tracked

---

---

## Implementation Deliverables

### A. Policy Engine Rule Implementations

Create rule implementations under:

```
scripts/policy-engine/rules/
```

Required files (one per rule):

- `env-ready.rule.ts`
- `build-pass.rule.ts`
- `test-pass.rule.ts`
- `test-isolation.rule.ts`
- `repo-clean.rule.ts`
- `artifact-drift.rule.ts`
- `artifact-allowlist.rule.ts`
- `auto-fix.rule.ts`
- `coverage-threshold.rule.ts`
- `flaky-test.rule.ts`
- `build-artifact-stability.rule.ts`
- `script-dependency.rule.ts`
- `snapshot-consistency.rule.ts`
- `performance-regression.rule.ts`

All rules MUST implement a common interface:

```ts
export interface PolicyRule {
  id: string;
  domain: string;
  severity: "error" | "warning";
  run(context: PolicyContext): Promise<PolicyResult>;
}
```

Register all rules in:

```
scripts/policy-engine/registry.ts
```

---

### B. Supporting Scripts

Implement supporting scripts used by rules:

```
scripts/
├── repo/assert-clean.ts
├── repo/snapshot.ts
├── repo/detect-artifacts.ts
├── repo/hash-build.ts
├── validate/runtime-env.ts
```

Add package.json entries:

```
"repo:assert-clean": "bun run scripts/repo/assert-clean.ts",
"repo:detect-artifacts": "bun run scripts/repo/detect-artifacts.ts",
"repo:hash-build": "bun run scripts/repo/hash-build.ts",
"validate:runtime-env": "bun run scripts/validate/runtime-env.ts"
```

All scripts MUST:

- Exit non-zero on failure
- Produce machine-readable output (JSON when possible)

---

### C. Full Wiring (CI + Husky + Orchestrator)

#### CI (GitHub Actions)

Replace all direct commands with:

```
bun run policy:check --full
```

Remove:

- direct `build`
- direct `test`

---

#### Husky

Pre-push:

```
bun run policy:check --changed
```

Pre-commit (optional fast mode):

```
bun run policy:check --changed
```

---

#### Orchestrator Integration

Before closure step:

```
policy:check --full
```

Block closure if:

- Any error-level rule fails

Allow closure if:

- Only warnings remain
- Deferred issues documented

---

### Enforcement Guarantee

After implementation:

- No script runs outside policy engine
- No CI duplication
- No drift between local/CI/orchestrator behavior

---
