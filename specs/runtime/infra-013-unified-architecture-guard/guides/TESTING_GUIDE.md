# Testing Guide — STAGE_INFRA_13_UNIFIED_ARCHITECTURE_GUARD

**Stage:** STAGE_INFRA_13_UNIFIED_ARCHITECTURE_GUARD  
**Phase:** 01_PLATFORM_FOUNDATION  
**Stage Directory:** infra-013-unified-architecture-guard  
**Generated On:** 2026-03-12

---

## Purpose

Validate that the unified architecture guard implementation is functionally correct, deterministic, and safe to run in strict and changed modes without introducing runtime business behavior changes.

---

## Summary of Delivered Behavior

This stage introduces a consolidated governance runner that executes architecture guard rules, emits structured violations, and maintains architecture intelligence artifacts for downstream AI/governance tooling.

Key outcomes:

- Strict mode blocks architecture violations deterministically.
- Changed mode scopes validation and falls back safely when needed.
- Architecture context and architecture brain validation hooks run in governance workflows.

---

## Prerequisites

| Requirement                | Validation Command / Check                                        |
| -------------------------- | ----------------------------------------------------------------- |
| Node.js installed          | `node --version` (v20+)                                           |
| Bun installed              | `bun --version` (v1+)                                             |
| Correct branch checked out | `git branch` includes `spec/infra-013-unified-architecture-guard` |
| Dependencies installed     | `bun install`                                                     |

---

## Files in Scope

```text
scripts/architecture-guard/**
scripts/ai-guard.ts
scripts/type-safety-guard.ts
tests/static/architecture-guard/**
tests/integration/architecture-context/**
tests/performance/architecture-guard/**
packages/domain-core/src/auth/jwt-handler.ts
packages/domain-core/package.json
specs/runtime/infra-013-unified-architecture-guard/**
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Strict architecture validation
bun run arch:guard:ci

# Changed-scope architecture validation
bun run arch:guard:changed
```

---

## Automated Validation Commands

```bash
# Stage static tests
vitest run tests/static/architecture-guard

# Stage integration tests
vitest run tests/integration/architecture-context

# Stage performance benchmark tests
vitest run tests/performance/architecture-guard

# Boundary baseline
bun run test:unit:boundaries

# Type check
bun run typecheck
```

Expected outcome: all listed stage-scoped validations pass.

---

## Manual Test Scenarios

### Scenario 1 — Strict Mode Blocks Violations

**Purpose:** Verify strict mode hard-fails prohibited architecture changes.

1. Introduce a controlled forbidden import using fixture patterns in `tests/static/architecture-guard/fixtures/us1-forbidden-import.ts`.
2. Run `bun run arch:guard:ci`.
3. Inspect output for `verdict=BLOCKED` and structured rule/location/remediation entries.

Expected: strict mode blocks the change and returns actionable violation records.

Troubleshooting: If verdict does not block, verify rule registration in `scripts/architecture-guard/rule-registry.ts` and runner mode resolution in `scripts/architecture-guard/mode.ts`.

### Scenario 2 — Changed Mode Scopes and Falls Back Safely

**Purpose:** Verify changed mode validates impacted scope and falls back deterministically when baseline is invalid.

1. Modify a single governed file under `apps/` or `packages/`.
2. Run `bun run arch:guard:changed` and inspect scope counters.
3. Simulate missing/stale baseline context and rerun changed mode.

Expected: changed mode runs impacted scope when possible, and emits fallback reason while completing full-scan fallback safely when required.

Troubleshooting: Review fallback reason logic in `scripts/architecture-guard/utils/fallback.ts` and scope expansion in `scripts/architecture-guard/utils/impact-expansion.ts`.

### Scenario 3 — Context Artifact and Brain Validation

**Purpose:** Ensure context generation/validation hooks remain healthy.

1. Run strict guard: `bun run arch:guard:ci`.
2. Validate generated architecture context artifacts in `docs/ai/context/`.

Expected: required artifacts are present and architecture brain validation passes.

---

## Negative Cases

| Scenario                           | Trigger                                      | Expected Response                                           |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| Invalid mode input                 | Run guard with unsupported mode flag         | Guard exits non-zero with clear mode error                  |
| Contract violation output mismatch | Modify reporter schema fields unexpectedly   | Contract schema/static tests fail                           |
| Missing baseline in changed mode   | Remove or invalidate baseline context source | Changed mode reports fallback reason and runs safe fallback |

Error responses and report payloads must preserve deterministic structured fields used by stage tests.

---

## Multi-Tenant Isolation Verification

1. Confirm no runtime route/controller/service logic was introduced in this stage.
2. Confirm changed files are governance/tooling artifacts and tests.
3. Run strict guard and ensure no new runtime tenant-path violations are reported.

Expected: no tenant isolation regression introduced by this stage.

---

## Structured Log Verification

Review governance output for deterministic structured violations:

- `rule`
- `location`
- `source_module`
- `remediation`

---

## Sign-Off Checklist

- [x] Required stage automated tests pass
- [x] Manual strict/changed/context scenarios validated
- [x] Contract and compatibility checks pass
- [x] Multi-tenant isolation unaffected by stage changes
- [x] No prohibited console/debug regressions introduced in stage files

---

## References

- `specs/runtime/infra-013-unified-architecture-guard/reports/IMPLEMENT_REPORT.md`
- `specs/runtime/infra-013-unified-architecture-guard/reports/PLAN_REPORT.md`
- `specs/runtime/infra-013-unified-architecture-guard/audits/VALIDATION_REPORT.md`

---

Generated by Zidney Orchestrator Hard Mode v1.2.0.
