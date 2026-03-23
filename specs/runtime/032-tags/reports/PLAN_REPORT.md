# Plan Report — Tags

**Step:** 3 — Plan  
**Timestamp:** 2026-03-23T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Technical plan is complete for the Tags feature. The plan introduces two new tenant-scoped tables (`tags` and `tag_relations`), a `packages/domain-core/src/tags/` domain package, a Zod validation schema file, nine Hono route handler files plus a router index, and a two-phase tenant DB migration (schema 1.15.0 → 1.16.0). All architectural patterns follow the established Zidney constitution precisely, matching the `category-values` reference implementation from Stage 031.

---

## Inputs Reviewed

- `specs/runtime/032-tags/spec.md` (20 FRs, 7 User Stories, 10 endpoints, clarifications section)
- `apps/api/src/routes/backoffice/category-values/index.ts` (route pattern)
- `apps/api/src/db/tenant/schemas/category-values.schema.ts` (Drizzle schema pattern)
- `apps/api/src/db/tenant/migrations/20260322_009_category_values.ts` (migration pattern, two-phase)
- `packages/domain-core/src/category-values/category-values.service.ts` (transaction pattern)
- `apps/api/src/app.ts` (route mount point — after `categoryValuesRouter`)
- `packages/domain-core/src/index.ts` (public export pattern)

---

## Architecture Layers Touched

| Layer          | Planned Changes                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| API            | 9 new Hono route handlers + router index in `apps/api/src/routes/backoffice/tags/`. Mounted in `apps/api/src/app.ts` after `categoryValuesRouter`. |
| Worker         | None — all operations synchronous.                                                                                                                 |
| Frontend       | None — this stage is API-only.                                                                                                                     |
| DB Master      | None — tags are tenant-scoped.                                                                                                                     |
| DB Tenant      | 2 new tables (`tags`, `tag_relations`), 1 new migration, 4 indexes, 2 FKs. Schema 1.15.0 → 1.16.0.                                                 |
| Domain Package | New package `packages/domain-core/src/tags/` — errors, types, repository, service, dependency-registry, index, tests.                              |
| Validation     | New `packages/validation/src/backoffice/tags.schemas.ts` — 6 Zod schemas.                                                                          |

---

## Key Technical Decisions

| #   | Decision                                                                                                        | Rationale                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `status` stored as `VARCHAR(20) + CHECK` not `ENUM`                                                             | Forward extensibility — adding new statuses does not require ENUM recast or a new migration                                                                                        |
| 2   | `entity_type` stored as `VARCHAR(40) + CHECK` not `ENUM`                                                        | Same extensibility rationale — future entity types can be added via migration constraint amendment                                                                                 |
| 3   | `normalized_name` UNIQUE index created `CONCURRENTLY` (Phase 2 outside transaction)                             | Follows established migration pattern; prevents table-lock on tenant DBs with existing data                                                                                        |
| 4   | Entity existence check handles `42P01` (undefined_table)                                                        | MCQ questions / library files don't exist yet — pre-emptive `42P01` catch prevents migration-time runtime errors; validation becomes functional once entity tables are provisioned |
| 5   | Tag filtering contract on entity list endpoints deferred                                                        | Entity list endpoints (MCQ, traditional, library) are future stages — contractual spec defined in `plan.md`, execution deferred                                                    |
| 6   | `ON DELETE CASCADE` on `tag_relations.tag_id`                                                                   | DB backstop ensuring no orphaned relation rows even if service-layer delete guard is bypassed                                                                                      |
| 7   | Same `BEGIN` / `ROLLBACK` transaction pattern as `category-values.service.ts`                                   | Consistency and pattern reuse; avoids introducing new transaction abstractions                                                                                                     |
| 8   | Permission guard: `question_manage` OR `content_manage` for tag management; entity-type-specific for assignment | Tags span both question management and library content domains; assignment requires the domain-specific permission                                                                 |

---

## Migration Impact

| Item                  | Value | Notes                                                                                                                                |
| --------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Migration required    | Yes   | `apps/api/src/db/tenant/migrations/20260323_010_tags.ts`                                                                             |
| Migration number      | 010   | Next sequential after `009_category_values`                                                                                          |
| `schema_version` bump | Yes   | 1.15.0 → 1.16.0                                                                                                                      |
| Migration phases      | 2     | Phase 1 inside BEGIN/COMMIT (DDL + FKs + B-tree indexes); Phase 2 outside transaction (CONCURRENT unique index on `normalized_name`) |
| Backward compatible   | Yes   | New tables only; no existing table modifications                                                                                     |
| `down()`              | Yes   | Drops `tag_relations` then `tags` (CASCADE-safe)                                                                                     |

---

## Transaction Boundaries

- `createTag` — `BEGIN → normalized_name uniqueness check → INSERT tags → COMMIT` (catches `23505` → `TAG_DUPLICATE`)
- `updateTag` — `BEGIN → existence check → normalized_name uniqueness check (self-exclude) → UPDATE tags SET updated_at=NOW() → COMMIT`
- `deleteTag` — `BEGIN → existence check → COUNT(tag_relations) > 0 check → DELETE tags → COMMIT`
- `createTagRelation` — `BEGIN → tag existence+enabled check → entityType validation → entity existence (+42P01 guard) → duplicate check → INSERT tag_relations → COMMIT` (catches `23505` → `TAG_RELATION_DUPLICATE`)
- `deleteTagRelation` — `BEGIN → relation existence check → DELETE tag_relations → COMMIT`
- Read operations (`listTags`, `getTag`, `listEntityTags`, `listTagEntities`) — no transaction required

---

## Idempotency Strategy

- **createTag** — normalized_name uniqueness at application layer (409) + DB UNIQUE backstop
- **createTagRelation** — application-level duplicate check (409) + `UNIQUE(tag_id, entity_type, entity_id)` DB backstop
- **deleteTag** — returns 404 for non-existent ID; callers can safely retry `DELETE /tags/:id`
- **deleteTagRelation** — returns 404 for non-existent ID; callers can safely retry `DELETE /tag-relations/:id`
- **updateTag** — same-value updates produce no state corruption; safe to reapply

---

## File Inventory

**New files (25):**

| File                                                              | Layer            |
| ----------------------------------------------------------------- | ---------------- |
| `apps/api/src/db/tenant/migrations/20260323_010_tags.ts`          | DB Migration     |
| `apps/api/src/db/tenant/schemas/tags.schema.ts`                   | DB Schema        |
| `apps/api/src/db/tenant/schemas/tag-relations.schema.ts`          | DB Schema        |
| `packages/domain-core/src/tags/tags.errors.ts`                    | Domain           |
| `packages/domain-core/src/tags/tags.types.ts`                     | Domain           |
| `packages/domain-core/src/tags/tags.repository.ts`                | Domain           |
| `packages/domain-core/src/tags/tags.service.ts`                   | Domain           |
| `packages/domain-core/src/tags/tags.dependency-registry.ts`       | Domain           |
| `packages/domain-core/src/tags/index.ts`                          | Domain           |
| `packages/domain-core/src/tags/__tests__/tags.service.test.ts`    | Tests            |
| `packages/domain-core/src/tags/__tests__/tags.repository.test.ts` | Tests            |
| `packages/validation/src/backoffice/tags.schemas.ts`              | Validation       |
| `apps/api/src/routes/backoffice/tags/index.ts`                    | Route            |
| `apps/api/src/routes/backoffice/tags/helpers.ts`                  | Route            |
| `apps/api/src/routes/backoffice/tags/create-tag.ts`               | Route            |
| `apps/api/src/routes/backoffice/tags/list-tags.ts`                | Route            |
| `apps/api/src/routes/backoffice/tags/get-tag.ts`                  | Route            |
| `apps/api/src/routes/backoffice/tags/update-tag.ts`               | Route            |
| `apps/api/src/routes/backoffice/tags/delete-tag.ts`               | Route            |
| `apps/api/src/routes/backoffice/tags/create-tag-relation.ts`      | Route            |
| `apps/api/src/routes/backoffice/tags/delete-tag-relation.ts`      | Route            |
| `apps/api/src/routes/backoffice/tags/list-entity-tags.ts`         | Route            |
| `apps/api/src/routes/backoffice/tags/list-tag-entities.ts`        | Route            |
| `tests/tags.integration.test.ts`                                  | Integration Test |

**Modified files (2):**

| File                                | Change                                                   |
| ----------------------------------- | -------------------------------------------------------- |
| `packages/domain-core/src/index.ts` | Add `export * from './tags'`                             |
| `apps/api/src/app.ts`               | Import + mount `tagsRouter` after `categoryValuesRouter` |

---

## Constitutional Compliance

| Check                                       | Status | Notes                                                                              |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| No cross-tenant logic introduced            | ✅     | `tags` and `tag_relations` are tenant-only tables; DB obtained from tenant context |
| All writes are transactional by design      | ✅     | All 5 write operations use explicit `BEGIN/COMMIT/ROLLBACK` pattern                |
| Server-authoritative time enforced          | ✅     | `created_at`/`updated_at` via `DEFAULT NOW()` — no client-supplied timestamps      |
| License middleware enforced                 | ✅     | License middleware runs before all backoffice route handlers                       |
| Version compatibility enforced              | ✅     | Migration bumps schema to 1.16.0; tenant resolver validates schema version         |
| No architecture redesign without ADR        | ✅     | No new patterns introduced; no ADR required                                        |
| No business logic in route layer            | ✅     | Handlers call service functions; no logic embedded in handlers                     |
| No direct DB instantiation                  | ✅     | DB obtained from `c.get('db')` via Hono context                                    |
| Idempotency enforced for critical write ops | ✅     | app-layer + DB backstop uniqueness for tag creation and relation creation          |

**Overall:** COMPLIANT — technical plan authorized for task generation.
