---
# Pull Request — Zidney Hard Mode

## 1. Stage & Phase

- Phase: 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT
- Stage: STAGE 42 – Student Management
- Branch: `spec/042-student-management`
- Stage Directory: `specs/runtime/042-student-management/`
- Stage File: `specs/phases/03_BACKOFFICE_CORE/05_USER_MANAGEMENT/STAGE_42_STUDENT_MANAGEMENT.md`
- Stage Status Before PR: BACKEND CLOSED
- Stage Status After PR: PRODUCTION READY

---

## 2. PR Type

- [x] Feature
- [ ] Architectural Change
- [ ] Infrastructure / Governance
- [ ] Security Hardening
- [ ] Refactor (No Behavior Change)
- [ ] Documentation
- [ ] Test Coverage
- [ ] Bug Fix

---

## 3. Executive Summary

- Adds tenant-scoped Student Management: CRUD, enable/disable, subscription updates, bulk-import
- Implements `packages/domain-core` students module (types, repository, service, errors, bulk-import)
- Adds validation schemas in `packages/validation`
- Adds migration `20260406_022_student_management` and Drizzle schema for tenant DB
- Adds backoffice routes and register them in the API
- Adds unit + integration tests (31 total) and passes full governance pipeline locally

---

## 4. Workflow Completion Evidence

Stage Directory: specs/runtime/042-student-management/

| Step      | Status      | Report Link                                                      |
| --------- | ----------- | ---------------------------------------------------------------- |
| Specify   | ✅ Complete | specs/runtime/042-student-management/reports/SPECIFY_REPORT.md   |
| Clarify   | ✅ Complete | specs/runtime/042-student-management/reports/CLARIFY_REPORT.md   |
| Plan      | ✅ Complete | specs/runtime/042-student-management/reports/PLAN_REPORT.md      |
| Tasks     | ✅ Complete | specs/runtime/042-student-management/reports/TASKS_REPORT.md     |
| Analyze   | ✅ Complete | specs/runtime/042-student-management/audits/ANALYZE_REPORT.md    |
| Implement | ✅ Complete | specs/runtime/042-student-management/reports/IMPLEMENT_REPORT.md |
| Closure   | ✅ Complete | specs/runtime/042-student-management/reports/CLOSURE_REPORT.md   |

---

## 5. Key Files / Changes

- `packages/domain-core/src/students/*` — new domain package files (types, errors, repository, service, bulk import, tests)
- `packages/validation/src/student.schema.ts` — new Zod validation schemas
- `apps/api/src/db/tenant/migrations/20260406_022_student_management.ts` — DB migration
- `apps/api/src/db/tenant/schemas/students.schema.ts` — Drizzle schema
- `apps/api/src/routes/backoffice/students/*` — route handlers + router
- `apps/api/src/routes/auth/frontoffice-login.ts` — migrated to students table
- `specs/runtime/042-student-management/*` — workflow reports, testing guide, PR summary

---

## 6. How to test locally

Run:

```bash
# Install
bun install

# Typecheck
rtk bun run typecheck

# Unit tests (domain-core)
npx vitest run --project domain-core "students"

# API integration tests
npx vitest run --project api "students"

# Full local CI (pre-merge validation)
bun run ci:run-local
```

---

## 7. Migration notes

- Migration `20260406_022_student_management` is forward-only. Run in staging first and validate queries that read tenant DB.

---

## 8. Checklist

- [x] All unit tests pass
- [x] Integration tests pass
- [x] Biome lint passes
- [x] Typecheck passes
- [x] AI/Architecture guard passed
- [x] Local CI simulation passed

---

## 9. Reviewers

Please review:

- Architecture: ensure tenant isolation expectations are met
- Security: review error contract and sensitive-field stripping
- DB: review migration and index strategy

---

PR ready to open from `spec/042-student-management`. Use this summary as the PR body and assign reviewers as appropriate.
