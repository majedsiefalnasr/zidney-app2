# Specify Report — Tags

**Step:** 1 — Specify  
**Timestamp:** 2026-03-23T00:05:00Z  
**Status:** COMPLETE

---

## Summary

Specification for the Tags stage has been produced. The feature implements a lightweight, flat,
non-hierarchical tagging system for supplementary content classification within Zidney tenant
workspaces. The spec covers two DB tables (`tags`, `tag_relations`), 10 API endpoints, 7 user
stories, 20 functional requirements, an error code registry, access control matrix, and test
requirements. All constitutional compliance declarations are present and passing.

---

## Inputs Reviewed

- `specs/runtime/032-tags/spec.md`
- `specs/runtime/032-tags/checklists/requirements.md`
- `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_32_TAGS.md`

---

## Key Decisions

| #   | Decision                                                                                    | Rationale                                                     |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Tags are tenant-scoped only — no global tag table                                           | Enforces database-per-tenant isolation (ADR)                  |
| 2   | `normalized_name` unique constraint enforced at DB level                                    | Prevents free-text duplication; lowercased + trimmed          |
| 3   | Polymorphic `tag_relations` table supports MCQ_QUESTION, TRADITIONAL_QUESTION, LIBRARY_FILE | Extensible without schema changes to entity tables            |
| 4   | Tag deletion blocked when relations exist — must `DISABLE` first                            | Preserves historical integrity of question/file relationships |
| 5   | Tag CRUD requires `question_manage` OR `content_manage` permission                          | Consistent with existing permission system                    |
| 6   | Tag filtering uses AND logic for multi-tag queries                                          | Enables strict narrowing; OR logic deferred to future scope   |

---

## Functional Requirements Captured

- Tag CRUD: CREATE with name normalization, LIST with status filter and pagination, GET by ID, PATCH name/status, DELETE (hard only if no relations)
- Tag assignment: ATTACH tag to entity (POST /tags/:id/assign), DETACH tag from entity (DELETE /tags/:id/assign/:entityType/:entityId), LIST tags on entity
- Tag-based entity filtering: paginated entity query filtered by single or multiple tags (AND logic)
- Normalization: `normalized_name` = lowercase + trim; unique at DB level
- Entity validation: entity_id must exist in tenant DB; entity_type must be valid enum value
- Duplicate prevention: unique(tag_id, entity_type, entity_id) constraint on `tag_relations`
- Lifecycle enforcement: DISABLED tags cannot be assigned; existing relations remain
- Deletion rules: blocked if relations exist; returns error with instruction to disable first
- Access control: `question_manage` OR `content_manage` required for tag management
- Isolation: All operations via tenant DB resolver; no cross-tenant references

---

## Clarifications Required

None — all requirements are clearly stated in the stage file. Proceeding to clarify step for additional edge-case resolution.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                                     |
| --------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Tags and tag_relations reside exclusively in tenant DB                                    |
| License middleware requirement captured | ✅     | Mandatory on all workspace/tag routes                                                     |
| Snapshot integrity requirement captured | ✅     | N/A — tags do not affect attempt snapshots                                                |
| Idempotency strategy defined            | ✅     | Tag assignment returns 409 on duplicate; creation returns 409 on normalized_name conflict |
| Transaction boundaries identified       | ✅     | Tag creation + normalization in single transaction                                        |
| Server-authoritative time enforced      | ✅     | created_at/updated_at set server-side only                                                |

**Overall:** COMPLIANT

---

## Open Risks

- None identified at specification stage.

---

## Next Step

Proceed to Step 2 — Clarify.
