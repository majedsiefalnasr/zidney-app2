# Quickstart: Architecture Alignment Migration

## Purpose

Use this runbook to execute the stage in the same order assumed by the plan.

## 1. Capture The Baseline

Run the full-scope governance tools and save their outputs for categorization.

```bash
bun run arch:guard -- --output json
bun scripts/infra-audit.ts
bun scripts/type-safety-guard.ts --json
```

Expected result:

- Full repository violation inventory.
- Findings grouped by boundary, cycle, unsafe type, export typing, script overlap, and artifact drift.

## 2. Prioritize By Category

Apply fixes in the following order:

1. Boundary and module violations that break the architecture contract.
2. Circular dependencies that prevent compliant layering.
3. Unsafe types and missing validation at trust boundaries.
4. Public export typing gaps.
5. Duplicate or overlapping legacy governance scripts.

## 3. Keep Remediation Within Scope

Do not change any of the following:

- Authentication, correlation, tenant resolution, or license middleware order.
- Database-per-tenant isolation model.
- Structured API response envelope on touched runtime paths.
- Server-authoritative attempt timing or worker grading authority.
- Existing ADR-backed architecture boundaries.

## 4. Refresh Architecture Intelligence

After remediation lands, regenerate the canonical architecture artifacts.

```bash
bun scripts/infra-audit.ts
bun scripts/generate-ai-context.ts --force
bun scripts/validate-architecture-brain.ts
```

## 5. Run Final Verification

```bash
bun run lint
bun run typecheck
bun run validate:types
bun run arch:guard:ci
bun scripts/infra-audit.ts
```

Then run targeted tests for changed modules or tenant-bound runtime paths.

If runtime-adjacent code changes, also verify the authentication flow and the standard `{ success, data, error }` response shape remain unchanged.

## 6. Stage Completion Criteria

The stage is ready for tasks and implementation only when:

- Baseline findings are categorized and actionable.
- Planned remediation paths stay within existing architecture rules.
- Canonical architecture intelligence can be regenerated and validated.
- Final verification can reasonably close with zero unresolved in-scope violations.
