# Requirements Checklist — MCQ Exam Configuration

**Stage:** STAGE_36_MCQ_EXAM_CONFIG
**Created:** 2026-04-01

---

## Spec Completeness

- [x] Feature overview describes what is being built
- [x] Feature identity established (what it IS vs what it IS NOT)
- [x] All functional requirements enumerated (FR-001 through FR-014)
- [x] Non-functional requirements documented (NFR-001 through NFR-006)
- [x] Data model tables defined with column types and constraints
- [x] API routes enumerated with methods and paths
- [x] Error codes defined with HTTP status mapping
- [x] Dependencies listed (upstream and downstream)

## Tenant Isolation

- [x] All tables reside in tenant database only
- [x] Tenant resolver middleware required on all routes
- [x] No cross-tenant query patterns
- [x] License middleware mandatory

## Security & Integrity

- [x] Input validation rules defined for all endpoints
- [x] Soft-delete pattern used (no hard delete)
- [x] Deletion guards documented (attempts, scheduled references)
- [x] Immutability constraints documented (subject_id, selection_mode lock)
- [x] Foreign key integrity constraints documented

## Workflow Integration

- [x] Workflow status transitions defined
- [x] Pre-enable validation criteria documented
- [x] Shared workflow engine used (no custom state machine)
- [x] Forward and backward transitions documented

## Data Model Quality

- [x] Primary keys defined for all tables
- [x] Foreign keys documented with reference targets
- [x] Index strategy defined (standard + partial/functional)
- [x] Unique constraints defined (code, exam_id+question_id, exam_id+order_index)
- [x] Nullable vs NOT NULL explicitly specified for all columns
- [x] Default values specified where applicable
- [x] Audit columns present (created_at, updated_at, created_by, updated_by)

## API Design

- [x] RESTful conventions followed
- [x] Pagination documented for list endpoint
- [x] Filter parameters documented
- [x] Request body schemas described
- [x] Response shapes described
- [x] Error responses mapped to error codes

## Snapshot Contract

- [x] Snapshot integrity requirement documented
- [x] No live references during attempt execution
- [x] Immutability rules for post-attempt changes defined

## Logging & Observability

- [x] Structured logging requirement documented
- [x] Correlation ID propagation required
- [x] State transition logging required
