# Plan Report — Categories (Classification Dimensions)

**Step:** 3 — Plan
**Timestamp:** 2026-03-22T00:03:00.000Z
**Status:** COMPLETE

---

## Summary

Complete technical plan produced for the Categories (Classification Dimensions) feature. All architectural questions resolved in research.md. Full data model documented in data-model.md. Plan covers migration, schema, domain package, API routes, middleware, transaction boundaries, hierarchy algorithm, tree assembly strategy, N+1 prevention, index strategy, and test matrix.

---

## Guardian Verdicts

| Guardian              | Verdict | Notes                                                                                                                                 |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture Guardian | ✅ PASS | W-01: `classification_manage` permission must be seeded. W-02: RBAC resolver middleware step clarification needed. Both non-blocking. |
| API Designer          | ✅ PASS | 3 non-blocking implementer notes. All 7 checks passed.                                                                                |

---

## Files Generated

| File            | Lines     | Purpose                                               |
| --------------- | --------- | ----------------------------------------------------- |
| `plan.md`       | ~400      | Complete implementation plan                          |
| `research.md`   | ~14 items | Resolved unknowns before planning                     |
| `data-model.md` | Full      | Schema DDL, Drizzle schema, TypeScript types, indexes |

---

## Architecture Decisions in Plan

| Decision                                               | Rationale                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Migration: `20260322_008_categories.ts` (tenant DB)    | Forward-only, tenant DB, schema 1.13.0 → 1.14.0                                             |
| CONCURRENT indexes run outside transaction block       | PostgreSQL requires CONCURRENT outside transactions; prevents write-blocking during fan-out |
| Flat bulk SELECT + in-memory tree assembly for `/tree` | Single SQL query O(N) vs N+1 per-parent queries                                             |
| `ANY($1::uuid[])` two-pass scope fetch                 | Eliminates N+1 for subject_ids/division_ids in list responses                               |
| `SELECT FOR UPDATE` on hierarchy-mutating transactions | Serializes concurrent parent_id writes; prevents circular reference race condition          |
| `requireAnyPermission` middleware (already exists)     | OR semantics for question_manage/classification_manage without code duplication             |

---

## Planned Files

### Migration

- `apps/api/src/db/tenant/migrations/20260322_008_categories.ts`

### Schema

- `apps/api/src/db/tenant/schema/categories.ts`
- `apps/api/src/db/tenant/schema/category-subjects.ts`
- `apps/api/src/db/tenant/schema/category-divisions.ts`

### Domain Package (`packages/domain-core/src/categories/`)

- `categories.types.ts`
- `categories.errors.ts`
- `categories.repository.ts`
- `categories.service.ts`
- `categories.tree.ts`
- `categories.dependency-registry.ts`
- `index.ts`

### Validation

- `packages/validation/src/backoffice/categories.schemas.ts`

### API Routes (`apps/api/src/routes/backoffice/categories/`)

- `index.ts` (router factory with middleware stack)
- `handlers/list-categories.ts`
- `handlers/create-category.ts`
- `handlers/get-category.ts`
- `handlers/get-categories-tree.ts`
- `handlers/update-category.ts`
- `handlers/delete-category.ts`

### Tests

- `packages/domain-core/src/categories/__tests__/categories.service.test.ts` (unit: 31 cases)
- `apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts` (integration: 22 cases)

---

## API Endpoints Planned

| Method | Route                                          | Auth | Permission                               |
| ------ | ---------------------------------------------- | ---- | ---------------------------------------- |
| GET    | `/api/v1/backoffice/workspace/categories`      | ✅   | None (read)                              |
| POST   | `/api/v1/backoffice/workspace/categories`      | ✅   | question_manage OR classification_manage |
| GET    | `/api/v1/backoffice/workspace/categories/tree` | ✅   | None (read)                              |
| GET    | `/api/v1/backoffice/workspace/categories/:id`  | ✅   | None (read)                              |
| PATCH  | `/api/v1/backoffice/workspace/categories/:id`  | ✅   | question_manage OR classification_manage |
| DELETE | `/api/v1/backoffice/workspace/categories/:id`  | ✅   | question_manage OR classification_manage |

---

## Risk Level

**HIGH** — Database migration, RBAC logic, multi-tenant isolation, circular ref detection algorithm.

---

## Next Step

Proceed to Step 4 — Tasks.
