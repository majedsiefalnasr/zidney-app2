# Analyze Report — Tags

**Step:** 5 — Analyze (Drift Detector)  
**Timestamp:** 2026-03-23T01:00:00Z  
**Final Verdict:** APPROVED — Implementation AUTHORIZED  
**Drift Passed:** true  
**Attempts:** 1

---

## Structural Drift Audit

All 9 constitutional criteria evaluated against `spec.md`, `plan.md`, and `tasks.md`.

| #   | Criterion                              | Status  | Evidence                                                                                                                                                                                                                                                     |
| --- | -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Tenant isolation                       | ✅ PASS | `tags` and `tag_relations` are exclusively in tenant DB. Tenant resolver mandatory before any route handler. No cross-tenant joins, no shared tables, no global singleton referenced in any plan task.                                                       |
| 2   | License middleware enforced            | ✅ PASS | T023 mounts `tagsRouter` under `BackofficeEnv` — platform-level license middleware runs before all backoffice handlers. No route bypasses license check.                                                                                                     |
| 3   | All writes transactional               | ✅ PASS | T007 service defines `BEGIN/COMMIT/ROLLBACK` for all 5 write operations (createTag, updateTag, deleteTag, createTagRelation, deleteTagRelation). All precondition reads execute inside the transaction.                                                      |
| 4   | Server-authoritative time              | ✅ PASS | T001/T002 schemas use `defaultNow()`. T003 migration uses `DEFAULT NOW()`. No client-supplied timestamp accepted in any request body schema (T011 Zod schemas have no timestamp fields).                                                                     |
| 5   | Idempotency                            | ✅ PASS | `createTag`: app-level normalized_name uniqueness check (409) + UNIQUE index DB backstop (23505 catch). `createTagRelation`: app-level duplicate check + `UNIQUE(tag_id, entity_type, entity_id)` DB backstop. Delete operations return 404 for missing IDs. |
| 6   | Version enforcement                    | ✅ PASS | T003 migration bumps schema_version 1.15.0 → 1.16.0 via in-transaction UPDATE. Tenant resolver validates schema_version at request boundary; incompatible tenants receive 426.                                                                               |
| 7   | No business logic in route layer       | ✅ PASS | T012 helpers contain only serialization/normalization utilities. T013–T022 handlers parse Zod schemas and delegate to service. No domain conditions in handler files.                                                                                        |
| 8   | No direct DB instantiation             | ✅ PASS | T022 router index factory receives Hono context; DB obtained via `c.get('db')`. No `new Pool()`, no `drizzle()` global — consistent with category-values reference pattern.                                                                                  |
| 9   | Structured logging with correlation ID | ✅ PASS | T007 service specifies `@zidney/logger` with `tag_id`, `workspace_id`, `correlation_id`, `caller_id` on all write events. No `console.log` in any task.                                                                                                      |

**Strict Pass Rule applied: 9/9 criteria passed = APPROVED.**

---

## Guardian Audits

### Architecture Guardian

**Verdict: PASS**

- No new module boundaries introduced. Tags domain follows the identical pattern as `category-values` (Stage 031).
- `packages/domain-core/src/tags/` follows the established package structure (errors → types → repository → service → registry → index).
- Route mount in `apps/api/src/app.ts` follows the established sequential pattern.
- No cross-app imports. No `apps/* → apps/*` violations. No `packages/* → apps/*` violations.
- Import order in task definitions: domain-core → validation → routes → app (correct layering).
- ADR-0001 (database-per-tenant) preserved. ADR-0007 (version enforcement) preserved.

### Security Guardian

**Verdict: PASS**

- RBAC `requireAnyPermission(['question_manage', 'content_manage'])` applied per route (T022).
- Entity-type-specific permission (`question_manage` vs `content_manage`) enforced at service layer (T007).
- All SQL via Drizzle parameterized queries — SQL injection risk mitigated.
- No stack traces exposed to client — DomainError maps to structured `{ success, data, error }` envelope.
- No sensitive data (tokens, hashes) in tag payloads.
- `name` length bounded at 255 chars via Zod validation (T011) — no unbounded input risk.
- JWT workspace scope enforced via tenant resolver (existing platform middleware).

### Performance Guardian

**Verdict: PASS**

- `UNIQUE(normalized_name)` created `CONCURRENTLY` outside transaction — no table lock on existing tenant DBs (two-phase migration, T003).
- `idx_tags_status` covers status-filtered list queries (T001).
- `idx_tag_relations_tag_id` covers tag→entity lookups (T002).
- `idx_tag_relations_entity` composite index covers entity→tag lookups (T002).
- Pagination bounded: `max per_page = 100`, default 20 — enforced via Zod `z.coerce.number().int().min(1).max(100).default(20)` (T011).
- No N+1 risk: `listEntityTags` and `listTagEntities` are single JOIN queries.
- No unbounded queries: all list operations include pagination.

### QA Guardian

**Verdict: PASS**

- T024: 14 unit test cases covering normalized_name computation, all error paths (TAG_DUPLICATE, TAG_HAS_RELATIONS, TAG_DISABLED, TAG_RELATION_INVALID_ENTITY_TYPE, TAG_RELATION_DUPLICATE, entity 42P01), successful operations, and list filtering.
- T025: 6 repository integration tests covering real DB constraints.
- T026–T033: 8 integration test groups covering full CRUD, uniqueness, delete guard, relation lifecycle, entity listing, tag entity listing, permission enforcement, and tenant isolation.
- T034: Migration validation (up + down, constraints, indexes).
- T035–T036: Lint + typecheck gates.
- T037: Full test suite execution.
- **Tenant isolation explicitly tested** (T033): cross-tenant tag visibility is a test requirement.

---

## Implementation Authorization

- **`drift_passed`:** true
- **`implementation_allowed`:** true
- **Violations:** None
- **Deferred items confirmed non-blocking:** Tag filtering on entity list endpoints is contractually specified in plan.md but correctly deferred — entity list endpoints don't exist. This is not a drift violation; it's a dependency on a future stage.

Implementation may begin immediately.
