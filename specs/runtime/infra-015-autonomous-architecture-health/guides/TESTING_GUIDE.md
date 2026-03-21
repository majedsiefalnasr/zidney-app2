# Testing Guide — Autonomous Architecture Health

**For**: QA Engineers, Integration Test Engineers, Release Verification Engineers  
**Date**: 2026-03-13  
**Stage**: INFRA-015

---

## Overview

This guide provides step-by-step testing procedures for the Autonomous Architecture Health governance system. All features are governance-only (no API, runtime, or tenant impact).

---

## Test Environment Setup

### Prerequisites

```bash
# Ensure clean working tree
git status  # Should show no uncommitted changes

# Install dependencies (if not already done)
bun install

# Verify governance tooling is available
bun run arch:guard --help
bun run arch:audit --help
bun run arch:health --help
```

### Test Fixtures

- ✅ Compliant state: Current repository (passes all internal validators)
- ✅ Degraded state: Simulated via test fixtures (known violations for regression testing)

---

## Unit Test Suite

### Test Location

```
tests/unit/architecture-health/
├── architecture-health.test.ts          # Integration tests
├── score-model.test.ts                   # Threshold evaluation
├── finding-normalizer.test.ts            # Deduplication
├── intelligence-synchronization.test.ts  # Sync detection
├── report-writer.test.ts                 # Artifact generation
├── cli-contract.test.ts                  # CLI behavior
└── source-runner.test.ts                 # Command execution
```

### Running Unit Tests

```bash
# Run all unit tests
bun run test:unit

# Expected output:
# Test Files  108 passed (108)
# Tests  962 passed | 1 skipped (963)

# Run only architecture-health tests
bun run test:unit 2>&1 | grep "architecture-health"

# Expected: All 7 files passing with full coverage
```

### Key Test Scenarios

#### T011–T012: Scoring & Deduplication

```bash
bun --test tests/unit/architecture-health/score-model.test.ts
```

✅ Verifies weighted threshold policy  
✅ Confirms PASS/BLOCKED verdict calculation  
✅ Validates finding fingerprinting

#### T016: Assessment Flow

```bash
bun --test tests/unit/architecture-health/architecture-health.test.ts
```

✅ Compliant state → PASSED assessment  
✅ Degraded state → BLOCKED assessment  
✅ Deterministic signal ordering

#### T022–T023: Synchronization

```bash
bun --test tests/unit/architecture-health/intelligence-synchronization.test.ts
bun --test tests/unit/architecture-health/report-writer.test.ts
```

✅ Detects stale artifact state  
✅ Generates deterministic reports  
✅ History snapshots avoid duplicates

#### T033: Command Execution

```bash
bun --test tests/unit/architecture-health/source-runner.test.ts
```

✅ Allowlist validation  
✅ Timeout enforcement  
✅ Telemetry collection

#### T017: CLI Contract

```bash
bun --test tests/unit/architecture-health/cli-contract.test.ts
```

✅ `--ci` mode immutable behavior  
✅ Local `--threshold` exploration  
✅ `--refresh-context` option  
✅ `--fail-on-sync` handling

---

## Static / Integration Test Suite

### Test Location

```
tests/static/07-architecture-health-governance.test.ts  (678 lines)
```

### Running Static Tests

```bash
bun run test:static 2>&1 | grep "07-architecture-health"
```

**Expected**: ✅ All static tests passing (governance compliance verified)

### Test Coverage

| Scenario                       | Expected Result                                                |
| ------------------------------ | -------------------------------------------------------------- |
| **Governance Workflow Gating** | CI thresholds prevent unhealthy merges                         |
| **Nightly Scheduling**         | Reports generated on schedule                                  |
| **Artifact Publication**       | JSON/Markdown/history published to `docs/architecture/health/` |
| **Performance Budgets**        | p95 duration within configured limits (T034)                   |
| **Trust Chain Preservation**   | No tenant isolation breaches, no API changes                   |
| **Lint Regression**            | Static rules prevent lint violations from creeping back        |

---

## CLI Manual Testing

### Test: Local Compliant Assessment

```bash
# Run health assessment on current (clean) repo
bun run arch:health

# Expected output:
# - Consolidated assessment JSON displayed
# - Status: PASSED
# - Signals normalized from: arch:guard, infra-audit, type-safety-guard
# - Findings: Deduplicating any recurring issues
# - Duration: < 30s (p95 budget)
```

### Test: Local Exploration Mode

```bash
# Lower threshold temporarily for testing (local only, not CI)
bun run arch:health --threshold 50

# Expected:
# - Assessment runs with exploratory threshold (50 instead of 75)
# - Results may show BLOCKED for illustrative purposes
# - Does NOT change CI or production thresholds
```

### Test: Context Refresh (Optional)

```bash
# Refresh architecture intelligence before assessment
bun run arch:health --refresh-context

# Expected:
# - Triggers `npx gitnexus analyze` (if index is stale)
# - Regenerates architecture brain
# - Assessment proceeds with fresh context
# - Duration: 60–90s (includes GitNexus)
```

### Test: CI Mode (Immutable)

```bash
# Simulate CI behavior (threshold locked)
bun run arch:health --ci

# Expected:
# - Assessment runs with locked threshold (75)
# - Any `--threshold` flag is ignored (safety feature)
# - Exit code: 0 (PASSED) or 1 (BLOCKED)
```

### Test: Synchronization Warnings

```bash
# If GitNexus index is stale:
bun run arch:health --ci --fail-on-sync

# Expected:
# - Assessment detects stale GitNexus index
# - Finding recorded: "Architecture intelligence index is stale"
# - Remediation guidance: "Run `npx gitnexus analyze`"
# - Exit code: 1 (BLOCKED due to sync failure flag)
```

---

## Report Artifact Verification

### Location

```
docs/architecture/health/
├── architecture-health.json        # Current assessment (JSON)
├── architecture-health-summary.md  # Summary report (Markdown)
├── architecture-drift-report.md    # Drift details (Markdown)
└── history/
    ├── 2026-03-13T150000Z.json     # Timestamped snapshot
    ├── 2026-03-13T150100Z.json     # (same state = not duplicated)
    └── ...
```

### Verification Checklist

#### ✅ JSON Structure

```bash
jq . docs/architecture/health/architecture-health.json
# Verify all required fields present:
# - timestamp
# - status (PASSED|BLOCKED)
# - signals (array of normalized findings)
# - score (numeric 0–100)
# - verdict (pass/blocked)
# - evidence (array of findings)
```

#### ✅ History Idempotence

```bash
# Run assessment twice in quick succession
bun run arch:health
bun run arch:health

# Expected: Only ONE new history snapshot created
# (Same repository state = no new snapshot)
ls -1 docs/architecture/health/history/ | wc -l
# Should show same count before and after second run if state unchanged
```

#### ✅ Schema Validation (T027)

```bash
# All generated reports validate against schema
jq --slurpfile schema specs/runtime/infra-015-autonomous-architecture-health/contracts/architecture-health-report.schema.json \
   'schema[0] | . as $schema | input | ($schema | $schema) as $rules | . as $data | 1' \
   docs/architecture/health/architecture-health.json

# Expected: Valid (exit code 0)
```

---

## Governance Validation Sequence

### Baseline Validators (All Should PASS)

```bash
echo "=== Running arch:guard:ci ==="
bun run arch:guard:ci
# Expected: ✅ No violations

echo "=== Running infra-audit ==="
bun run arch:audit
# Expected: ✅ Score 100/100, 0 layer violations, 0 drift

echo "=== Running validate-brain ==="
bun run arch:validate:brain
# Expected: ✅ Valid or "PASSED WITH WARNINGS"

echo "=== Running type-safety-guard ==="
bun run arch:type-safety-guard --json 2>&1 | jq .violations[0:2]
# Expected: Minimal external violations (not from stage code)
```

---

## Regression Testing

### Test: Simulated Architecture Violation

**Purpose**: Verify health assessment detects known violations

```bash
# Manually introduce a test violation (for testing only):
# 1. Create a temporary test file with a known issue
# 2. Run assessment
# 3. Verify violation is detected in findings
# 4. Revert change

# Note: Full regression test implemented in tests/static/07-architecture-health-governance.test.ts
bun run test:static 2>&1 | grep "regress\|violation"
```

### Test: Stale Intelligence Detection

**Purpose**: Verify health assessment detects when architecture intelligence is stale

```bash
# (Simulated in unit tests)
bun --test tests/unit/architecture-health/intelligence-synchronization.test.ts

# Expected: Test cases verify stale detection, missing artifacts, async refresh handling
```

---

## Performance Benchmarks (T034)

### Running Benchmark Suite

```bash
# Full benchmark harness (20+ runs, p95 validation)
bun run test:static 2>&1 | grep -A 5 "benchmark\|duration\|p95"
```

### Expected Results

| Metric                     | Threshold      | Actual                           |
| -------------------------- | -------------- | -------------------------------- |
| **p95 Duration (local)**   | < 30s          | Should be ✅                     |
| **p95 Duration (CI mode)** | < 45s          | Should be ✅                     |
| **Consistent Scoring**     | ±0 variance    | All runs same score ✅           |
| **Report Determinism**     | Byte-identical | Same state = identical output ✅ |

---

## Failure Scenarios & Recovery

### Scenario: Assessment BLOCKED

**Symptoms**: `arch:health` returns exit code 1, status: BLOCKED

**Diagnosis**:

```bash
# Check findings for specific violations
bun run arch:health | jq .findings
# Look for category, severity, message

# Example findings:
# - "dependency_violation": imports across layer boundary
# - "drift_detected": architecture.map out of sync
# - "type_safety_gap": `any` type found in critical module
# - "intelligence_stale": GitNexus index needs refresh
```

**Recovery**:

1. If drift: Run `bun run arch:audit --fix-map` to sync
2. If type-safety: Address violations in source code, re-run
3. If intelligence stale: Run `npx gitnexus analyze`
4. If dependencies: Refactor imports to respect layer boundaries
5. Re-run assessment: `bun run arch:health`

### Scenario: Timeout During Scanner Execution

**Symptoms**: Assessment hangs or times out after ~30s

**Diagnosis**:

```bash
# Check system load, network (GitNexus queries)
top
# Monitor GitNexus query performance
bun scripts/gitnexus-context.ts --stats
```

**Recovery**:

1. Skip context refresh: `bun run arch:health` (no `--refresh-context`)
2. Check GitNexus index: `npx gitnexus status`
3. Report timeout if persists; timeout budgets may need tuning

---

## Logging & Observability

### Check Structured Logs

```bash
# All logs to health scanner are structured (JSON)
bun run arch:health 2>&1 | jq '[.timestamp, .level, .action]' 2>/dev/null | head -10

# Expected:
# [
#   ["2026-03-13T15:30:00Z", "INFO", "assessment_started"],
#   ["2026-03-13T15:30:02Z", "DEBUG", "collector_baseline_governance_running"],
#   ["2026-03-13T15:30:05Z", "INFO", "assessment_complete"],
#   ...
# ]
```

### Expected Structured Fields

- `timestamp` — ISO 8601
- `level` — DEBUG, INFO, WARN, ERROR
- `service` — "architecture-health"
- `action` — what happened
- `module` — which component
- `duration_ms` — execution time (if applicable)
- `correlation_id` — trace ID

---

## Sign-Off Checklist

After running all tests above, ensure:

- [ ] Unit tests pass: `bun run test:unit` (962/963)
- [ ] Static tests pass: `bun run test:static`
- [ ] Type-check passes: `bun typecheck`
- [ ] Governance validators pass: arch:guard, audit, validate-brain
- [ ] CLI default mode works: `bun run arch:health` completes in <30s
- [ ] CI mode locked: `bun run arch:health --ci` respects immutable threshold
- [ ] Reports generated: JSON, Markdown, history all present
- [ ] History idempotent: Re-running same state = no new snapshots
- [ ] Schema validation: Reports conform to contract schema
- [ ] Logs structured: All output is valid JSON
- [ ] No unhandled errors or panics observed
- [ ] Performance acceptable: All runs within p95 budgets

**Sign-Off**: QA verification complete ✅

---

## Questions?

Refer to:

- Feature specification: `specs/runtime/infra-015-autonomous-architecture-health/spec.md`
- Technical design: `specs/runtime/infra-015-autonomous-architecture-health/plan.md`
- CLI reference: `docs/architecture/health/README.md`
- Quick start: `specs/runtime/infra-015-autonomous-architecture-health/quickstart.md`
