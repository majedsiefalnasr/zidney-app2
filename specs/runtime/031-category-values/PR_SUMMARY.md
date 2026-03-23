# PR: Category Values — STAGE_31

---

## 1. Stage & Phase Information

| Field       | Value                                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| Stage       | Category Values                                                                         |
| Stage File  | `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_31_CATEGORY_VALUES.md` |
| Phase       | `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`                                        |
| Branch      | `spec/031-category-values`                                                              |
| Base Branch | `develop`                                                                               |
| Initiated   | 2026-03-18                                                                              |
| Completed   | 2026-03-22                                                                              |

---

## 2. PR Type

- [x] Feature
- [ ] Bug Fix
- [ ] Infrastructure
- [ ] Documentation
- [ ] Refactor

---

## 3. Executive Summary

**Problem solved:** Backoffice operators had no way to create, classify, or manage Category Values — the discrete classification entries that define valid options for question categories (e.g. "Easy / Medium / Hard" for a "Difficulty" category).

**What was delivered:**

- Full CRUD API for Category Values under `/api/v1/backoffice/workspace/{tenant}/category-values`
- Governed status lifecycle: `COMPLETED → UNDER_REVIEW → APPROVED → ENABLED / DISABLED`
- Multi-language translation support (create/update values per language code)
- Optional subject/division scope constraints per value
- Idempotent soft-delete with in-use guard
- Tenant-isolated at DB level (database-per-tenant, all queries workspace-scoped)
- 116 automated tests covering: service unit, repository unit, API integration, migration

**Architectural boundary:** Tenant DB layer → Domain package → Route handler. No business logic in route handler, no DB access outside repository, no cross-tenant joins.

**Constitutional guarantees:**

- ADR-0003: database-per-tenant isolation enforced (all SQL scoped to `client` from `getTenantClient`)
- ADR-0001: no shared global DB singleton
- ADR-0006: server-authoritative timestamps
- Error contract: `{ success, data, error: { code, message } }` on all responses

---

## 4. Workflow Completion Evidence

| Step      | Status               | Artifact                                                                |
| --------- | -------------------- | ----------------------------------------------------------------------- |
| Pre-Step  | ✅ Complete          | `specs/runtime/031-category-values/.workflow-state.json` branch created |
| Specify   | ✅ Complete          | `specs/runtime/031-category-values/spec.md`                             |
| Clarify   | ✅ Complete          | `specs/runtime/031-category-values/spec.md` (clarifications appended)   |
| Plan      | ✅ Complete          | `specs/runtime/031-category-values/plan.md`                             |
| Tasks     | ✅ Complete          | `specs/runtime/031-category-values/tasks.md` (25 tasks)                 |
| Analyze   | ✅ Complete (PASSED) | `specs/runtime/031-category-values/audits/ANALYZE_REPORT.md`            |
| Implement | ✅ Complete (25/25)  | `specs/runtime/031-category-values/reports/IMPLEMENT_REPORT.md`         |
| Closure   | ✅ Complete          | `specs/runtime/031-category-values/reports/CLOSURE_REPORT.md`           |

---

## 5. Constitutional Compliance Checklist

- [x] Database-per-tenant isolation enforced (ADR-0003): all queries use `getTenantClient(context)`
- [x] No global DB singleton: no `import db from ...` in route or domain files
- [x] License middleware applied: backoffice router includes `licenseMiddleware`
- [x] Authentication middleware applied: all routes behind `authMiddleware`
- [x] Authorization enforced: `question_manage` or `classification_manage` permission required for writes; `classification_manage` for sensitive reads
- [x] Server-authoritative time (ADR-0006): all timestamps use `new Date()` server-side; no client-supplied timestamps
- [x] Error contract: all response types use `{ success: boolean, data: T | null, error: AppError | null }`
- [x] Structured logging: all services and handlers use `@zidney/logger` with `namespace`, `workspace_slug`, and `correlation_id`
- [x] No stack traces to client: error serialization strips internal traces before response
- [x] Input validation at boundary only: Zod schemas in `packages/validation`; pure business rules inside domain
- [x] No cross-tenant joins: all queries scoped to single tenant DB connection
- [x] Idempotency: soft-delete is idempotent; duplicate code check in `createCategoryValue`
- [x] Transactions: multi-table writes (translations, subjects, divisions) wrapped in DB transactions
- [x] Import boundary: `apps/api` → `packages/*` only; no `packages/*` → `apps/*` imports
- [x] Migration is forward-only: no destructive operations; safe to run multiple times via `IF NOT EXISTS`

---

## 6. Tenant Isolation & Security Verification

| Check                                                | Result                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| No cross-workspace DB queries                        | ✅ All queries use per-request `getTenantClient`                                      |
| No default DB fallback                               | ✅ Missing tenant context throws `TENANT_NOT_FOUND` before any DB call                |
| All queries workspace-scoped                         | ✅ `category_values.category_id` → `categories.workspace_id` (always tenant-bound)    |
| Soft-delete does not expose deleted rows             | ✅ All list/get queries filter `WHERE deleted_at IS NULL` by default                  |
| Permission checks on all write operations            | ✅ `hasPermission(user, 'question_manage' or 'classification_manage')`                |
| In-use guard before delete                           | ✅ `checkCategoryValueInUse` called before soft-delete                                |
| No PII logging                                       | ✅ Translated values are never logged at `info` level                                 |
| Error codes are non-enumerable (no user enumeration) | ✅ `CATEGORY_VALUE_NOT_FOUND` does not reveal whether record exists in another tenant |

---

## 7. Files Changed (31 files)

### New Files — Migration

| File                                                                                | Purpose                                                                                 |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/api/src/db/tenant/migrations/20260322_009_category_values.ts`                 | Creates `category_values`, `category_value_subjects`, `category_value_divisions` tables |
| `apps/api/src/db/tenant/migrations/__tests__/009_category_values.migration.test.ts` | 16 migration tests                                                                      |

### New Files — Drizzle Schemas

| File                                                                | Purpose                                       |
| ------------------------------------------------------------------- | --------------------------------------------- |
| `apps/api/src/db/tenant/schemas/category-values.schema.ts`          | Drizzle schema for `category_values`          |
| `apps/api/src/db/tenant/schemas/category-value-subjects.schema.ts`  | Drizzle schema for `category_value_subjects`  |
| `apps/api/src/db/tenant/schemas/category-value-divisions.schema.ts` | Drizzle schema for `category_value_divisions` |

### Modified Files — Schemas

| File                                      | Change                                 |
| ----------------------------------------- | -------------------------------------- |
| `apps/api/src/db/tenant/schemas/index.ts` | Added barrel exports for 3 new schemas |

### New Files — Validation Schemas

| File                                                            | Purpose                                   |
| --------------------------------------------------------------- | ----------------------------------------- |
| `packages/validation/src/backoffice/category-values.schemas.ts` | Zod schemas: create, update, list, params |

### New Files — Domain Package

| File                                                                                    | Purpose                 |
| --------------------------------------------------------------------------------------- | ----------------------- |
| `packages/domain-core/src/category-values/category-values.types.ts`                     | Domain types + enums    |
| `packages/domain-core/src/category-values/category-values.errors.ts`                    | Error constants         |
| `packages/domain-core/src/category-values/category-values.repository.ts`                | SQL repository (raw pg) |
| `packages/domain-core/src/category-values/category-values.service.ts`                   | Business logic          |
| `packages/domain-core/src/category-values/category-values.registry.ts`                  | DI registry factory     |
| `packages/domain-core/src/category-values/__tests__/category-values.service.test.ts`    | 45 service tests        |
| `packages/domain-core/src/category-values/__tests__/category-values.repository.test.ts` | 24 repository tests     |

### Modified Files — Domain Package

| File                                | Change                                   |
| ----------------------------------- | ---------------------------------------- |
| `packages/domain-core/src/index.ts` | Added barrel exports for category-values |
| `packages/domain-core/package.json` | No external dep changes (internal only)  |

### New Files — Route Layer

| File                                                                                           | Purpose                     |
| ---------------------------------------------------------------------------------------------- | --------------------------- |
| `apps/api/src/routes/backoffice/category-values/helpers.ts`                                    | Route context helpers       |
| `apps/api/src/routes/backoffice/category-values/list-category-values.ts`                       | GET /category-values        |
| `apps/api/src/routes/backoffice/category-values/create-category-value.ts`                      | POST /category-values       |
| `apps/api/src/routes/backoffice/category-values/get-category-value.ts`                         | GET /category-values/:id    |
| `apps/api/src/routes/backoffice/category-values/update-category-value.ts`                      | PATCH /category-values/:id  |
| `apps/api/src/routes/backoffice/category-values/delete-category-value.ts`                      | DELETE /category-values/:id |
| `apps/api/src/routes/backoffice/category-values/index.ts`                                      | Router factory              |
| `apps/api/src/routes/backoffice/category-values/__tests__/category-values.integration.test.ts` | 31 integration tests        |

### Modified Files — App Registration

| File                  | Change                                                              |
| --------------------- | ------------------------------------------------------------------- |
| `apps/api/src/app.ts` | Registered Category Values router under backoffice workspace routes |

---

## 8. Test Results

| Suite                                   | Tests   | Passed  | Failed |
| --------------------------------------- | ------- | ------- | ------ |
| `category-values.service.test.ts`       | 45      | 45      | 0      |
| `category-values.repository.test.ts`    | 24      | 24      | 0      |
| `category-values.integration.test.ts`   | 31      | 31      | 0      |
| `009_category_values.migration.test.ts` | 16      | 16      | 0      |
| **TOTAL**                               | **116** | **116** | **0**  |

TypeScript: 0 errors  
Biome lint: 0 errors  
Architecture governance: PASS  
Infra audit: PASS

---

## 9. Migration Notes

| Field           | Value                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration file  | `20260322_009_category_values.ts`                                                                                                                       |
| Schema version  | `1.15.0`                                                                                                                                                |
| Tables created  | `category_values`, `category_value_subjects`, `category_value_divisions`                                                                                |
| Indexes created | 8 indexes including `unique_category_values_code` CONCURRENT unique index on `(category_id, lower(code)) WHERE deleted_at IS NULL`                      |
| Foreign keys    | `category_value_subjects.category_value_id → category_values.id` (CASCADE), `category_value_divisions.category_value_id → category_values.id` (CASCADE) |
| Reversibility   | Forward-only. Rollback requires a new migration to drop the 3 tables.                                                                                   |

**No data migration** — migration only creates new tables.  
**No breaking changes** — existing endpoints are unaffected.

---

## 10. Architecture Boundary

```
apps/api/src/routes/backoffice/category-values/   ← Route layer (Hono handlers)
    ↕ (import)
packages/domain-core/src/category-values/          ← Domain layer (pure business logic + SQL)
    ↕ (import)
apps/api/src/db/tenant/schemas/                    ← Drizzle type schemas (no business logic)
    ↕ (import)
packages/validation/src/backoffice/               ← Zod validation (boundary only)
```

No lateral communication between apps.  
No `packages/*` → `apps/*` imports.  
No UI-visible DB schemas.

---

## 11. Infra Audit

```bash
# Run full infra audit
bun scripts/infra-audit.ts

# Expected: PASS — no new violations
```

```bash
# Run AI guard
bun scripts/ai-guard.ts

# Expected: PASS — all architecture contracts satisfied
```

---

## 12. Stage Lifecycle Verification

- [x] Stage file status updated to `PRODUCTION READY`
- [x] `.workflow-state.json` updated to `stage_production_ready`
- [x] `tasks_completed === tasks_total` (25 / 25)
- [x] All 9 history events present in workflow state
- [x] No deferred tasks
- [x] No unresolved clarifications
- [x] Governance metadata lock (7.8A, 7.8B, 7.8C, 7.8D) passed

---

## 13. Deployment Readiness

| Check                  | Result                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- |
| Safe for staging       | ✅ — migration is additive-only, no existing tables modified                     |
| Safe for production    | ✅ — CONCURRENT index creation avoids table lock; migration is idempotent        |
| Feature flags needed   | None — feature is gated by backoffice role/permission model                      |
| Seed data needed       | None — values are operator-created, not pre-seeded                               |
| Post-deploy validation | Run `bun run db:migrate` then smoke-test `GET /category-values?category_id=<id>` |

---

## 14. Risk Assessment

**Risk Level:** HIGH

| Factor                 | Detail                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Irreversible migration | 3 new tables; rollback requires a new migration, not a down() call                                                                                 |
| Multi-tenant isolation | Every DB query scoped to tenant client — regression here is a critical data breach                                                                 |
| Status lifecycle       | Incorrect transitions (e.g. ENABLED → COMPLETED) would corrupt downstream question classification                                                  |
| Lock conflict paths    | Concurrent write attempts on the same code produce 409 — callers must handle retry                                                                 |
| In-use guard           | Deleting a value referenced by MCQ/TQ options must be blocked; guard tested but downstream consumers added later must also respect this constraint |

---

## 15. Final Statement

All 25 tasks have been implemented, reviewed, and validated.  
116 automated tests pass. TypeScript and Biome report zero errors.  
The feature is fully isolated within the tenant DB layer and complies with Zidney Constitution v1.2.0.  
This branch is ready for review and merge into `develop`.
