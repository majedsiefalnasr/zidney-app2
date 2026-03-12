# Quickstart: Architecture Alignment Migration

## Purpose

Use this runbook to execute the stage in the same order assumed by the plan.

## 1. Freeze Scope And Invariants

Create the foundational stage evidence before any baseline or remediation work:

- `audits/GOVERNED_SCOPE.md`
- `guides/RUNTIME_INVARIANTS.md`
- `audits/LEGACY_SCRIPT_REVIEW.md`
- `audits/REMEDIATION_TRACKER.md`

Expected result:

- Governed file allowlist frozen.
- Runtime invariants frozen.
- Toolchain ownership documented.
- Remediation tracker ready to record either clean-state evidence or exact file-scoped fixes.

## 2. Capture The Baseline

Run the full-scope governance tools and save their outputs for categorization.

```bash
bun run arch:guard -- --output json
bun scripts/infra-audit.ts
bun scripts/type-safety-guard.ts --json
```

Expected result:

- Full repository violation inventory.
- Findings grouped by boundary, cycle, unsafe type, export typing, script overlap, and artifact drift.

If all three commands report zero in-scope violations, record a clean baseline and do not invent remediation work.

## 3. Evaluate Clean-State Outcome

If the baseline is clean:

- Record zero-violation evidence in the stage audit files.
- Mark repository remediation as `not-required`.
- Limit implementation to stage-local evidence, canonical artifact refresh, and closure verification.

If the baseline is not clean, convert every finding into an exact file-scoped tracker entry before implementation.

## 4. Prioritize By Category

Apply fixes in the following order:

1. Boundary and module violations that break the architecture contract.
2. Circular dependencies that prevent compliant layering.
3. Unsafe types and missing validation at trust boundaries.
4. Public export typing gaps.
5. Duplicate or overlapping legacy governance scripts.

## 5. Keep Remediation Within Scope

Do not change any of the following:

- Authentication, correlation, tenant resolution, or license middleware order.
- Database-per-tenant isolation model.
- Structured API response envelope on touched runtime paths.
- Schema-version or product-version compatibility checks.
- Existing transaction, idempotency, secret-handling, or structured-log guarantees.
- Server-authoritative attempt timing or worker grading authority.
- Existing ADR-backed architecture boundaries.

## 6. Refresh Architecture Intelligence

After remediation lands, regenerate the canonical architecture artifacts.

```bash
bun scripts/infra-audit.ts
bun scripts/generate-ai-context.ts --force
bun scripts/validate-architecture-brain.ts
```

## 7. Run Final Verification

```bash
bun run lint
bun run validate:types
bun run arch:guard:ci
bun scripts/infra-audit.ts
```

Then run targeted tests for changed modules or tenant-bound runtime paths.

If runtime-adjacent code changes, also verify authentication flow, correlation propagation, schema and product compatibility checks, the standard `{ success, data, error }` response shape, and existing transaction and idempotency guarantees remain unchanged.

If scripts, logging surfaces, API hot paths, or worker hot paths change, also verify secret handling, structured log hygiene, and performance-sensitive behavior remain unchanged.

## 8. Stage Completion Criteria

The stage is ready for tasks and implementation only when:

- Baseline findings are categorized and actionable.
- Clean-state evidence is recorded when no remediation is required.
- Planned remediation paths stay within existing architecture rules.
- Canonical architecture intelligence can be regenerated and validated.
- Final verification can reasonably close with zero unresolved in-scope violations.
