# Requirements Checklist — Traditional Exam Configuration

## Functional Completeness

- [x] FR-1: Exam CRUD (create, list, get, update, soft delete)
- [x] FR-2: Delivery settings (get, upsert with mode constraints)
- [x] FR-3: Exam content structure (sections, subsections, question assignment)
- [x] FR-4: Workflow status transitions (DRAFT → UNDER_REVIEW → APPROVED → ENABLED → DISABLED)
- [x] FR-5: Structural validation before ENABLED
- [x] FR-6: Division-scoped access control

## Data Model

- [x] traditional_exams table defined with all columns
- [x] traditional_exam_settings table defined (1:1 with exam)
- [x] traditional_exam_sections stub ALTER planned (add template_section_id, header_content, order_index)
- [x] traditional_exam_subsections stub ALTER planned (add template_subsection_id, header_content, order_index)
- [x] traditional_exam_questions join table defined with snapshot score

## Architecture Governance

- [x] Tenant isolation: all access via resolver context
- [x] No cross-tenant references
- [x] License middleware requirement captured
- [x] Error contract: { success, data, error }
- [x] Structured logging with correlation_id
- [x] Snapshot integrity: score copied at assignment time
- [x] Transactions: exam creation is atomic
- [x] Idempotency: unique constraint on question assignment

## Security

- [x] RBAC guards defined for all endpoints
- [x] Division-scoped filtering enforced
- [x] Input validation via Zod schemas
- [x] Soft delete (no hard delete of exams)

## Dependencies

- [x] traditional_questions table (Stage 35) — exists
- [x] traditional_exam_sections stub (Stage 35) — exists
- [x] traditional_exam_subsections stub (Stage 35) — exists
- [x] subjects table — exists
- [x] RBAC middleware — exists
- [x] Tenant resolver — exists
