# PR Summary — Subjects (STAGE_28)

Branch: `spec/028-subjects` → Target: `develop`

## Executive Summary

- Adds Subjects domain (types, errors, repository, service) and backoffice CRUD endpoints.
- Migration creates `subjects` table with required indexes and is idempotent.
- All 27 tasks implemented, with full unit (19) and integration (17) test coverage.
- Validation gates (lint, typecheck) pass; stage is production-ready.

## Artifacts

- Spec: `specs/runtime/028-subjects/spec.md`
- Plan: `specs/runtime/028-subjects/plan.md`
- Tasks: `specs/runtime/028-subjects/tasks.md`
- Implement report: `specs/runtime/028-subjects/reports/IMPLEMENT_REPORT.md`
- Validation report: `specs/runtime/028-subjects/audits/VALIDATION_REPORT.md`
- Closure report: `specs/runtime/028-subjects/reports/CLOSURE_REPORT.md`
- Testing guide: `specs/runtime/028-subjects/guides/TESTING_GUIDE.md`

## Testing

- Unit tests: `rtk vitest run packages/domain-core/src/subjects/__tests__/subjects.service.test.ts` → PASS (19/19)
- Integration tests: `rtk vitest run apps/api/src/routes/backoffice/subjects/__tests__/subjects.integration.test.ts` → PASS (17/17)
- Lint: `bun run lint` → PASS (0 errors)
- Typecheck: `bun run typecheck` → PASS (0 errors)

## Migration Plan

- Migration file: `apps/api/src/db/tenant/migrations/20260320_006_subjects.ts` — idempotent with `IF NOT EXISTS` guards.
- Tenant fan-out: standard tenant migration process; follow existing per-tenant migration scripts.

## Risk

- Risk Level: MEDIUM — new migration introduced, but guarded and tested.

## Reviewers

- Architecture
- Security
- QA

---

Use this PR summary when creating the PR on GitHub. Ensure reviewers follow the Hard Mode checklist in the PR template.
