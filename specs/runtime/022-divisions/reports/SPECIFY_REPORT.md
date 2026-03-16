# Specify Report — Divisions

**Step:** 1 — Specify
**Timestamp:** 2026-03-16T00:00:00Z
**Status:** COMPLETE

---

## Summary

The specification for STAGE_22_DIVISIONS (Divisions) has been fully generated. The spec covers the
complete implementation of Division as the primary academic isolation layer within a Zidney tenant
workspace. All 10 required specification areas are captured. No `[NEEDS CLARIFICATION]` markers
remain. The stage is ready for the Clarify step.

---

## Inputs Reviewed

- `specs/runtime/022-divisions/spec.md`
- `specs/runtime/022-divisions/checklists/requirements.md`
- `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_22_DIVISIONS.md`

---

## Key Decisions

| #   | Decision                                                                       | Rationale                                                                                       |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1   | Default division is immutable — cannot be deleted, disabled, or demoted        | System correctness: at least one division must always exist; single-division mode depends on it |
| 2   | Students: exactly one division (division_id NOT NULL, FK enforced)             | Academic boundary rule — no student may exist outside a division                                |
| 3   | Staff: many-to-many via staff_divisions join table, minimum one division       | Staff may span multiple academic groups; validated at API layer                                 |
| 4   | disable-divisions operation is transactional and irreversible                  | Prevents partial state; all FK references reassigned atomically to default division             |
| 5   | Feature flag (workspace-level) controls UI mode; backend enforcement unchanged | Even in single-division mode, the table exists and default division is the implicit scope       |
| 6   | Division filtering enforced on all content retrieval endpoints                 | Prevents cross-division content leakage at the backend layer                                    |
| 7   | Name uniqueness is per-workspace (within tenant DB)                            | Tenant isolation model — divisions are tenant-scoped                                            |
| 8   | Disable-divisions rate limited to 1 req/min/workspace                          | Protects against accidental or malicious repeated destructive operations                        |

---

## Functional Requirements Captured

- FR-001: Workspace admin can create a new division with name, optional description
- FR-002: Name must be unique within the workspace; returns DIV_NAME_DUPLICATE on conflict
- FR-003: Division status defaults to ENABLED on creation
- FR-004: Default division is auto-created at tenant bootstrap (STAGE_17); cannot be deleted
- FR-005: GET /divisions returns paginated, filterable list with status filter
- FR-006: GET /divisions/:id returns single division details
- FR-007: PUT /divisions/:id allows name and description updates; validates uniqueness
- FR-008: PATCH /divisions/:id/status toggles ENABLED/DISABLED; cannot disable default division
- FR-009: DELETE /divisions/:id hard-deletes non-default, non-referenced divisions
- FR-010: Disable-divisions operation reassigns all references to default division transactionally
- FR-011: POST /staff/:id/divisions assigns staff to one or more divisions (replaces assignment)
- FR-012: All APIs return { success, data, error } contract
- FR-013: division_id enforced NOT NULL on students at DB level
- FR-014: Staff must have at least one division assigned (validated at API layer)
- FR-015: Visibility enforcement: WHERE division_id IN (allowed_divisions_for_user)
- FR-016: All writes are transactional
- FR-017: All timestamps set server-side (created_at, updated_at via DB defaults)
- FR-018: Structured logging with all required fields (correlation_id, workspace_slug, workspace_id)
- FR-019: Migration adds divisions table, staff_divisions table, backfills students.division_id
- FR-020: Schema version incremented in migration
- FR-021: Cannot delete division with active student or subject references (ON DELETE RESTRICT)
- FR-022: disable-divisions logs who triggered, timestamp, and affected_records_count
- FR-023: Error codes defined for all failure cases (11 codes)
- FR-024: RBAC: WORKSPACE_ADMIN required for mutating operations; all roles can read
- FR-025: Feature toggle in workspace settings controls division UI mode (single vs. multi)

---

## Clarifications Required

None — all specification areas fully resolved.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                      |
| --------------------------------------- | ------ | -------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | All tables in tenant DB only; resolver middleware mandatory                |
| License middleware requirement captured | ✅     | All routes require active license; SOFT_LOCKED → 423, ARCHIVED → 403       |
| Snapshot integrity requirement captured | ✅     | Not applicable (no attempt logic in this stage)                            |
| Idempotency strategy defined            | ✅     | disable-divisions is idempotent (no-op if already in single-division mode) |
| Transaction boundaries identified       | ✅     | All writes transactional; disable-divisions is a single atomic transaction |
| Server-authoritative time enforced      | ✅     | All timestamps set by DB defaults; no client timestamps accepted           |

**Overall:** COMPLIANT

---

## Open Risks

| #   | Risk                                                               | Severity | Mitigation                                                           |
| --- | ------------------------------------------------------------------ | -------- | -------------------------------------------------------------------- |
| 1   | disable-divisions may affect large workspaces / many FK rows       | Medium   | Transactional reassignment; rate-limited; confirmation required      |
| 2   | Students backfill during migration (assigning default division_id) | Medium   | Migration strategy documented; handled in a single forward migration |
| 3   | Staff with zero divisions if assignment validation is bypassed     | Low      | API validation + DB constraint on staff_divisions (min 1 check)      |
