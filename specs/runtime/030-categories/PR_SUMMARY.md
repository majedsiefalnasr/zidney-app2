---
# Pull Request — Zidney Hard Mode

## 1. Stage & Phase

- Phase: 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION
- Stage: STAGE_30_CATEGORIES — Categories (Classification Dimensions)
- Branch: `spec/030-categories`
- Stage Directory: `specs/runtime/030-categories/`
- Stage File: `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_30_CATEGORIES.md`
- Stage Status Before PR: IN PROGRESS
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

- Implements the categories domain — a classification dimension system for tagging exam questions and content along configurable axes (e.g. Difficulty, Bloom Level, Topic Type)
- Touches tenant DB layer (new migration), domain-core package (new categories module), validation package, and API routes — no cross-app boundary violations
- Safe because all writes are transactional, soft-delete semantics are used (no hard deletes), and the migration is forward-only with CONCURRENT index creation outside the transaction
- Tenant isolation preserved: all SQL queries use the tenant pool extracted from Hono context; no shared global DB state
- Permission enforcement: write endpoints require `classification:manage` or `question:manage`; schema version middleware enforces `>= 1.14.0`
- Full constitutional compliance: ADR-0001 (tenant isolation), ADR-0006 (server time), ADR-0007 (version enforcement), ADR-0008 (semantic versioning) all verified
- 54 tests pass (26 unit + 28 integration), lint clean, typecheck clean, architecture score 100/100

---

## 4. Workflow Completion Evidence

Stage Directory: specs/runtime/030-categories/

| Step      | Status      | Report Link                                              |
| --------- | ----------- | -------------------------------------------------------- |
| Specify   | ✅ Complete | specs/runtime/030-categories/reports/SPECIFY_REPORT.md   |
| Clarify   | ✅ Complete | specs/runtime/030-categories/reports/CLARIFY_REPORT.md   |
| Plan      | ✅ Complete | specs/runtime/030-categories/reports/PLAN_REPORT.md      |
| Tasks     | ✅ Complete | specs/runtime/030-categories/reports/TASKS_REPORT.md     |
| Analyze   | ✅ Complete | specs/runtime/030-categories/audits/ANALYZE_REPORT.md    |
| Implement | ✅ Complete | specs/runtime/030-categories/reports/IMPLEMENT_REPORT.md |
| Closure   | ✅ Complete | specs/runtime/030-categories/reports/CLOSURE_REPORT.md   |

---

## 5. Constitutional Compliance Checklist

- [x] ADR-0001 — Database-per-tenant isolation preserved (tenant pool from Hono context; no cross-tenant queries)
- [x] ADR-0002 — Snapshot immutability not applicable (categories not used in attempt snapshots)
- [x] ADR-0006 — Server-authoritative time only (all timestamps via `NOW()` in SQL)
- [x] ADR-0007 — Version compatibility enforced (`MIN_SCHEMA_VERSION = '1.14.0'` in router)
- [x] ADR-0008 — Semantic versioning respected (migration bumps `1.13.0 → 1.14.0`)
- [x] No cross-tenant access introduced
- [x] No middleware bypass created (tenant resolver + license + schema version applied to all routes)
- [x] No shared mutable global state introduced
- [x] ARCHITECTURE_MAP.json rules preserved (ai-guard PASS)

---

## 6. Isolation & Security Verification

- [x] No cross-workspace joins
- [x] No default DB fallback (`getDb(c)` throws if tenant pool is missing)
- [x] All queries scoped to workspace DB (per-tenant pool isolation)
- [x] Structured logging (no console.log; `logger.error` on exceptions; correlation IDs in AuditContext)
- [x] Error contract compliance (`{ success, data, error }` in all responses via `ok()` / `fail()`)
- [x] Sensitive data not logged (only correlation IDs and error codes)

---

## 7. Database Changes

Migration file: `apps/api/src/db/tenant/migrations/20260322_008_categories.ts`

**Phase A (transactional — BEGIN/COMMIT):**

- `CREATE TABLE IF NOT EXISTS categories` — 10 columns, CHECK constraint on `status`
- `CREATE TABLE IF NOT EXISTS category_subjects` — FK to categories + subjects, CASCADE
- `CREATE TABLE IF NOT EXISTS category_divisions` — FK to categories + divisions, CASCADE
- All FK constraints via conditional DO $$ block
- B-tree indexes: `idx_categories_parent_id`, `idx_categories_status`, `idx_category_subjects_category_id`, `idx_category_subjects_subject_id`, `idx_category_divisions_category_id`, `idx_category_divisions_division_id`
- Permission seeds: `classification:manage`, `question:manage` for ADMIN role (ON CONFLICT DO NOTHING)
- Schema version bump: `1.13.0 → 1.14.0` in `_schema_versions`

**Phase B (after COMMIT — concurrent):**

- `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_categories_name` on `LOWER(name)`
- `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_categories_code` on `LOWER(code) WHERE code IS NOT NULL`

**Rollback plan:** No automatic rollback (forward-only migrations). To revert: drop tables `category_divisions`, `category_subjects`, `categories` and revert schema version to `1.13.0`.

---

## 8. API Changes

New endpoints mounted at `/api/backoffice/{workspace}/categories`:

| Method | Path    | Permission Required                          | Description                            |
| ------ | ------- | -------------------------------------------- | -------------------------------------- |
| GET    | `/`     | None (workspace user)                        | List categories (paginated + filtered) |
| POST   | `/`     | `classification:manage` OR `question:manage` | Create category                        |
| GET    | `/tree` | None (workspace user)                        | Full/partial category tree             |
| GET    | `/:id`  | None (workspace user)                        | Get single category with scope         |
| PATCH  | `/:id`  | `classification:manage` OR `question:manage` | Update category                        |
| DELETE | `/:id`  | `classification:manage` OR `question:manage` | Soft-delete category                   |

All endpoints:

- Require valid tenant (tenant resolver middleware)
- Require active license (license middleware)
- Require schema version >= `1.14.0` (schema version middleware)
- Return `{ success, data, error }` contract

---

## 9. Error Codes Introduced

| Code                             | HTTP | Meaning                                                    |
| -------------------------------- | ---- | ---------------------------------------------------------- |
| `CATEGORY_NOT_FOUND`             | 404  | Category ID does not exist in this tenant                  |
| `CATEGORY_NAME_DUPLICATE`        | 409  | Category name (case-insensitive) already exists            |
| `CATEGORY_CODE_DUPLICATE`        | 409  | Category code (case-insensitive) already exists            |
| `CATEGORY_PARENT_NOT_FOUND`      | 404  | Specified parent_id does not exist                         |
| `CATEGORY_MAX_DEPTH_EXCEEDED`    | 422  | Category hierarchy would exceed 4 levels                   |
| `CATEGORY_CIRCULAR_REFERENCE`    | 422  | Re-parent would create a circular reference                |
| `CATEGORY_DISABLED`              | 422  | Cannot update fields on a disabled category                |
| `CATEGORY_ALREADY_DISABLED`      | 422  | Category is already disabled                               |
| `CATEGORY_ALREADY_ENABLED`       | 422  | Category is already enabled                                |
| `CATEGORY_HAS_ENABLED_CHILDREN`  | 422  | Cannot disable category with enabled children              |
| `CATEGORY_HAS_DEPENDENT_CONTENT` | 422  | Category is referenced by content (reserved for STAGE_31+) |
| `CATEGORY_SUBJECT_NOT_FOUND`     | 404  | One or more subject_ids not found in tenant                |
| `CATEGORY_DIVISION_NOT_FOUND`    | 404  | One or more division_ids not found in tenant               |
| `VALIDATION_ERROR`               | 400  | Request body/query failed Zod validation                   |

---

## 10. Tests

| Test File                                                                            | Type        | Count | Status      |
| ------------------------------------------------------------------------------------ | ----------- | ----- | ----------- |
| `packages/domain-core/src/categories/__tests__/categories.service.test.ts`           | Unit        | 26    | ✅ All pass |
| `apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts` | Integration | 28    | ✅ All pass |

**Coverage includes:** success paths for all 6 service functions, all 14 error codes, RBAC enforcement (403), license enforcement (423/403), schema version mismatch (409), tenant isolation (cross-tenant 404), rate limit enforcement (429), tree assembly, scope replace semantics.

Run with:

```bash
bun run vitest run packages/domain-core/src/categories/__tests__/categories.service.test.ts
bun run vitest run apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts
```

---

## 11. Architecture & Governance Validation

```bash
bun scripts/infra-audit.ts   # Score: 100/100 ✅
bun scripts/ai-guard.ts      # PASS ✅
bun run lint                 # 0 errors ✅
bun run typecheck            # 0 errors ✅
```

---

## 12. Stage Lifecycle Verification

- [x] Stage Status updated in `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_30_CATEGORIES.md` → `PRODUCTION READY`
- [x] `.workflow-state.json` updated to `PRODUCTION READY`, `stage_production_ready`, 9 history events
- [x] `README.md` progress table complete — all 8 steps ✅
- [x] All step reports generated in `reports/` and `audits/`

---

## 13. Deployment Readiness

- [x] Safe for staging
- [x] Safe for production
- [x] No feature flags required
- [ ] Runbook updated (N/A — no operational changes required)

---

## 14. Risk Assessment

Risk Level:

- [ ] Low
- [ ] Medium
- [x] **High**

Explanation: Stage includes a database migration (3 new tables, CONCURRENT unique indexes), security-sensitive permission seeding, multi-tenant isolation logic, and complex hierarchical data semantics (circular reference guard, max depth enforcement). All factors have been fully tested and quality-gated.

---

## 15. Final Statement

This PR maintains Zidney architectural integrity and complies with Hard Mode governance.

All 8 workflow steps completed. All reports generated. Stage lifecycle updated to PRODUCTION READY. 35/35 tasks complete. 54/54 tests pass. Architecture score 100/100. Lint and typecheck clean.

Reviewer Sign-off:

- [ ] Architecture Approved
- [ ] Security Approved
- [ ] Ready to Merge

---

## PR Checklist Enforcement (CI)

Local verification:

```bash
bun scripts/infra-audit.ts
bun scripts/ai-guard.ts
bun run vitest run packages/domain-core/src/categories/__tests__/categories.service.test.ts
bun run vitest run apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts
```

---
