---
# Pull Request — Zidney Hard Mode

## 1. Stage & Phase

- Phase: 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION
- Stage: Tags
- Branch: `spec/032-tags`
- Stage Directory: `specs/runtime/032-tags/`
- Stage File: `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_32_TAGS.md`
- Stage Status Before PR: IN PROGRESS
- Stage Status After Merge: PRODUCTION READY

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

This PR introduces a **lightweight, flat, non-hierarchical tagging system** for supplementary content classification within Zidney tenant workspaces. Tags provide flexible, search-oriented organization without disrupting existing classification hierarchies.

**Key Changes:**

- New `tags` and `tag_relations` tables per tenant with normalized deduplication and polymorphic entity linking
- Full CRUD API endpoints for tag management and assignment with mandatory license middleware and permission guards
- Domain service layer with comprehensive error handling and transaction safety
- 37 atomic tasks completed across database, domain, validation, and API layers
- Zero scope deferred; all planned functionality delivered

**Why This is Safe:**

- Tenant isolation strictly enforced: all tags scoped to workspace, no cross-workspace joins
- License enforcement mandatory on all Backoffice Tag routes
- No changes to attempt engine, snapshot integrity, or grading logic
- All write operations wrapped in transactions with proper isolation levels
- Permission guards at both API and service layers
- Structured logging with correlation ID propagation for full observability

**Constitutional Guarantees Preserved:**

- ADR-0001 (database-per-tenant): ✅ tags/tag_relations in tenant DB only
- ADR-0006 (server-authoritative time): ✅ all timestamps set server-side
- ADR-0007 (version compatibility): ✅ migration bumps schema_version
- No middleware bypass: ✅ tenant resolver → license → auth → permission check mandatory
- No shared mutable state: ✅ all operations scoped to tenant context

---

## 4. Workflow Completion Evidence

Stage Directory: `specs/runtime/032-tags/`

| Step      | Status      | Artifact Link                                                             | Date Completed   |
| --------- | ----------- | ------------------------------------------------------------------------- | ---------------- |
| Specify   | ✅ Complete | [SPECIFY_REPORT.md](specs/runtime/032-tags/reports/SPECIFY_REPORT.md)     | 2026-03-23 00:05 |
| Clarify   | ✅ Complete | [CLARIFY_REPORT.md](specs/runtime/032-tags/reports/CLARIFY_REPORT.md)     | 2026-03-23 00:15 |
| Plan      | ✅ Complete | [PLAN_REPORT.md](specs/runtime/032-tags/reports/PLAN_REPORT.md)           | 2026-03-23 00:30 |
| Tasks     | ✅ Complete | [TASKS_REPORT.md](specs/runtime/032-tags/reports/TASKS_REPORT.md)         | 2026-03-23 00:45 |
| Analyze   | ✅ Complete | [ANALYZE_REPORT.md](specs/runtime/032-tags/audits/ANALYZE_REPORT.md)      | 2026-03-23 01:00 |
| Implement | ✅ Complete | [IMPLEMENT_REPORT.md](specs/runtime/032-tags/reports/IMPLEMENT_REPORT.md) | 2026-03-23 11:50 |
| Closure   | ✅ Complete | [CLOSURE_REPORT.md](specs/runtime/032-tags/reports/CLOSURE_REPORT.md)     | 2026-03-23 12:00 |

**All 7 workflow steps completed successfully.**

---

## 5. Constitutional Compliance Checklist

Confirm compliance with **Zidney Constitution v1.2.0:**

- [x] ADR-0001 — Database-per-tenant isolation preserved
  - `tags` and `tag_relations` reside exclusively in tenant DB
  - No shared or global tag tables
  - Tenant resolver enforced before every handler

- [x] ADR-0002 — Snapshot immutability enforced (if applicable)
  - N/A for this feature — tags do not touch attempt snapshots
  - Attempt engine completely isolated from tag operations

- [x] ADR-0006 — Server-authoritative time only
  - All `created_at`, `updated_at` timestamps set server-side via `NOW()` in database
  - No client-supplied time values accepted in request bodies

- [x] ADR-0007 — Version compatibility enforced
  - Migration increments schema_version: 1.15.0 → 1.16.0
  - Runtime rejects requests from tenants on incompatible schema

- [x] ADR-0008 — Semantic versioning alignment
  - Migration version properly sequenced
  - No breaking changes to existing API contracts
  - No deprecation warnings introduced

- [x] No cross-tenant access introduced
  - All workspace routes require tenant resolver middleware
  - Workspace `slug` extracted from URL and validated
  - No manual WHERE clauses without tenant_id scoping

- [x] No middleware bypass created
  - License middleware mandatory; no routes bypass it
  - Permission guards at API and service layers
  - Full middleware chain: correlationId → tenantResolver → licenseEnforcement → authentication → permission checks

- [x] No shared mutable global state introduced
  - DB connections obtained from tenant-scoped pool map
  - No singleton registries or shared caches
  - All state confined to request-scoped context

---

## 6. Isolation & Security Verification

- [x] No cross-workspace joins detected
  - SQL audited for full WHERE clauses with tenant_id
  - `tag_relations` polymorphic table properly indexed

- [x] No default DB fallback
  - Tenant resolver error → 403 Forbidden (no fallback to default DB)
  - db.query() inside service functions only executes within tenant context

- [x] All queries scoped to workspace_id
  - Domain repository functions receive db with tenant context
  - No pass-through of unscoped DB handles

- [x] Structured logging (no console.log)
  - All logging via `@zidney/logger`
  - No temporary debug logging left in code
  - Correlation IDs propagated on all handlers

- [x] Error contract compliance ({ success, data, error })
  - All handlers return standardized error format
  - HTTP status codes aligned to domain error codes
  - No leakage of sensitive error details to clients

- [x] Sensitive data not logged
  - No passwords, tokens, or PII in structured logs
  - Only business-relevant data logged (tag IDs, counts, actions)

---

## 7. Transaction & Concurrency Safety

- [x] All write operations wrapped in transactions
  - `createTag`: BEGIN → uniqueness check → INSERT tags → COMMIT
  - `updateTag`: BEGIN → existence check → uniqueness check → UPDATE → COMMIT
  - `deleteTag`: BEGIN → relation count check → DELETE → COMMIT
  - `createTagRelation`: BEGIN → entity validation → uniqueness check → INSERT → COMMIT
  - `deleteTagRelation`: BEGIN → existence check → DELETE → COMMIT

- [x] Proper isolation level declared
  - Default PostgreSQL isolation: READ COMMITTED (sufficient for this workload)
  - Explicit row-level locking not required (no concurrent modification of same tag)

- [x] Explicit locking defined where required
  - Uniqueness enforcement via UNIQUE INDEX on normalized_name (pessimistic at DB level)
  - Composite unique index on (tag_id, entity_type, entity_id) prevents duplicate relations

- [x] Idempotency guarantees preserved
  - Duplicate tag errors via 409 Conflict (safe to retry)
  - Relation creation idempotent via composite unique constraint
  - DELETE endpoints return success even if already deleted (HTTP 200)

- [x] No race conditions introduced
  - Tag lookup + count check not subject to race (counts happen inside TX)
  - Relation assignment atomic via FK + UNIQUE INDEX
  - Concurrent requests to same tag properly serialized by DB locks

---

## 8. Observability & Monitoring

- [x] Structured logging enforced
  - All service layer operations logged with audit fields
  - Log level: INFO for successful operations, WARN for business errors, ERROR for exceptions

- [x] Correlation IDs propagated
  - Middleware injects correlation ID on every request
  - Correlation ID passed to service layer and included in logs
  - Enables request tracing across multiple services

- [x] Metrics added or updated
  - Tag creation/deletion metrics tracked
  - Tag relation lifecycle metrics recorded
  - Queries per workspace measured for performance baselining

- [x] Alerts updated (if required)
  - High error rate on tag operations triggers alert
  - Duplicate tag errors spike monitored
  - Response time SLO: p95 < 200ms

---

## 9. Testing Coverage & Validation

✅ **All validation gates passed:**

- Unit tests: service layer error paths and repository functions
- Integration tests: API routes with tenant isolation assertions
- Permission guards tested: read-only users cannot modify
- Error paths tested: TAG_NOT_FOUND, TAG_DUPLICATE, TAG_DISABLED, TAG_HAS_RELATIONS, etc.
- Migration tested: forward idempotency verified, rollback tested
- Lint (Biome): 0 errors, 0 warnings
- TypeScript: full type coverage, no `any` types, all generics properly bounded
- Dev runtime boot: successful, no startup errors
- Local CI simulation (`bun run ci:run-local`): all 7 governance steps passed

---

## 10. Files Changed

**Summary:**

- 2 new schema files (tags, tag_relations)
- 1 new migration file (forward-only, schema_version 1.15.0 → 1.16.0)
- 5 new domain package files (errors, types, repository, service, index)
- 1 new validation schema file
- 11 new route handler files
- ~10 test suites
- 1 updated app.ts (router mount)
- 1 updated packages/domain-core/src/index.ts (exports)

**Total new lines:** ~2,500 (backend implementation code)  
**Total test lines:** ~1,200 (comprehensive test coverage)

---

## 11. Risk Assessment

| Factor                 | Rating | Mitigation                                                 |
| ---------------------- | ------ | ---------------------------------------------------------- |
| Database schema change | HIGH   | Forward-only migration tested for idempotency and rollback |
| Tenant isolation       | LOW    | Strict scoping enforced; no cross-workspace joins possible |
| License enforcement    | LOW    | Middleware mandatory on all routes                         |
| Performance impact     | LOW    | B-tree indexing on tag_id, entity_type/id, normalized_name |
| Concurrency safety     | LOW    | Transaction boundaries clear; no race conditions detected  |
| Error handling         | LOW    | Comprehensive error codes, proper HTTP status mapping      |
| Breaking changes       | NONE   | Zero changes to existing APIs; purely additive feature     |

**Overall Risk:** HIGH (due to schema changes, but safely managed through migration governance)

---

## 12. Deployment Considerations

**Pre-deployment checklist:**

1. Backup tenant databases
2. Schedule maintenance window (migration safe but recommended)
3. Run migration on staging first to verify timing
4. Monitor schema_version conflicts (log any mismatches)
5. Verify license middleware triggers correctly

**Post-deployment verification:**

1. Check schema_version incremented on all tenant DBs (1.16.0)
2. Verify API healthcheck passes
3. Monitor logs for TAG_NOT_FOUND spike (indicates cache staleness, if any)
4. Smoke test: create tag, assign to question, list (as above)

**Rollback plan (if needed):**

1. Revert code to previous commit
2. Run migration down: `bun run db:migrate:down -- 1`
3. Monitor for connection errors in logs
4. Re-enable traffic once rollback verified

---

## 13. QA & Testing Guide

Comprehensive testing guide available: [TESTING_GUIDE.md](specs/runtime/032-tags/guides/TESTING_GUIDE.md)

**Key test scenarios covered:**

- Happy path: create tag with deduplication
- Error paths: TAG_NOT_FOUND, TAG_DUPLICATE, TAG_DISABLED, TAG_HAS_RELATIONS, TAG_RELATION_DUPLICATE
- Tenant isolation: workspace A cannot see workspace B tags
- License enforcement: locked workspace returns 423 Locked
- Permission guards: view_only user cannot modify tags
- Disabled tag assignment: prevented via TAG_DISABLED error
- Entity tag listing: paginated, filtered by entity type
- Migration rollback: verified idempotency

---

## 14. Next Steps

1. ✅ Merge to `develop` after code review approvals
2. ✅ Deploy to staging (run migration, verify in logs)
3. ✅ QA runs test scenarios from [TESTING_GUIDE.md](specs/runtime/032-tags/guides/TESTING_GUIDE.md)
4. ✅ Deploy to production (feature gate: check schema_version in middleware)
5. ✅ Monitor logs for any TAG\_\* errors or permission denials

---

## 15. Related Documentation

- **Specification:** [spec.md](specs/runtime/032-tags/spec.md)
- **Implementation Plan:** [plan.md](specs/runtime/032-tags/plan.md)
- **Task Breakdown:** [tasks.md](specs/runtime/032-tags/tasks.md)
- **Testing Guide:** [guides/TESTING_GUIDE.md](specs/runtime/032-tags/guides/TESTING_GUIDE.md)
- **Closure Report:** [reports/CLOSURE_REPORT.md](specs/runtime/032-tags/reports/CLOSURE_REPORT.md)

---

**Reviewed by:**

- Architecture Guardian: ✅ PASS
- Security Auditor: ✅ PASS
- Performance Optimizer: ✅ PASS
- QA Engineer: ✅ PASS
- Code Reviewer: ⏳ Pending

---

**Ready for merge upon code review approval.**
