# Contribution Guide

Zidney is a multi-tenant, exam-centric, white-label SaaS platform.

The system is:

- Stability-first
- Spec-driven
- Isolation-enforced
- Migration-controlled
- AI-assisted but rule-governed

All contributions must respect architectural contracts.

---

## Before Writing Code

You must:

- Read the relevant stage inside `/specs`
- Confirm feature belongs to the correct phase
- Check migration impact (master or tenant)
- Validate no cross-tenant leakage risk
- Confirm compatibility with current schema_version and product_version

No feature begins without a spec reference.

Every commit must be traceable to a spec stage.

---

## Development Flow

1. Create a feature branch from `main`
2. Reference the spec stage in branch name (example: `stage-34-mcq-model`)
3. Implement backend changes first
4. Add migration if required
5. Update API contracts
6. Implement frontend changes
7. Write unit tests
8. Run lint and type check locally
9. Run test suite locally
10. Open Pull Request

All development must pass local validation before PR.

---

## Local Validation Checklist

Before pushing:

- `bun run lint` passes
- `bun run typecheck` passes
- `bun run test` passes
- No TODO left in production code
- No console.log in committed code
- No edited historical migration files

Commit must fail if any validation fails.

---

## Pull Request Requirements

PR must include:

- Spec stage reference
- Migration summary (if applicable)
- Schema version impact
- Product version impact
- Security consideration (if relevant)
- Runtime performance consideration (if relevant)
- Confirmation tests were added

PR without spec reference will be rejected.

---

## Migration Rules

- Never edit an existing migration
- Every schema change requires new migration
- Migration must be deterministic
- Destructive migration requires ADR reference
- Tenant migrations must respect snapshot guarantees

See: `docs/01_ENGINEERING_GOVERNANCE/04_DATABASE_MIGRATION_POLICY.md`

---

## Architectural Guardrails

Forbidden actions:

- Cross-app imports
- Direct DB calls inside route handlers
- Instantiating DB connections manually
- Bypassing permission middleware
- Bypassing tenant resolver
- Editing historical migrations
- Skipping version compatibility checks
- Silent configuration changes

Violation is considered architectural regression.

---

## Code Review Expectations

Reviewer must verify:

- Tenant isolation respected
- License enforcement present
- Status workflow correct
- Permission enforcement enforced at middleware level
- Business logic isolated from controllers
- Structured logging present
- No schema drift introduced
- No breaking change without version bump

Review is architectural validation, not cosmetic review.

---

## Definition of Done

A feature is complete only if:

- Spec implemented fully
- Tests written
- Migrations validated
- Version compatibility verified
- Logs structured
- Lint passes
- CI passes
- Reviewer approved

If any condition fails, feature is not done.
