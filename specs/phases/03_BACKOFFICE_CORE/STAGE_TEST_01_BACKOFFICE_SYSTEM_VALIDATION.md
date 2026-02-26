# STAGE_TEST_01_BACKOFFICE_SYSTEM_VALIDATION

Phase: 03_BACKOFFICE_CORE  
Type: Cross-Stage Validation & Exit Gate  
Track: Tenant Backend + UI + Runtime Integration

---

## Purpose

This stage validates the entire Backoffice stack after all Phase 3 backend and UI stages are complete.

It is a full-system validation gate covering:

- Tenant database isolation
- Academic structure integrity
- Exam engine configuration
- User management & limits
- Commercial layer
- Media & communication modules
- Backoffice UI correctness
- Runtime interaction boundaries

This stage must pass before:

- Marking Phase 3 as PRODUCTION READY
- Beginning Phase 4 (Runtime) expansion work
- Allowing Frontoffice integration against tenant systems

---

## Scope

Covers all Backoffice stages:

- Tenant Bootstrap
- Workspace Settings
- Translation System
- Role & Permission System
- Academic Structure (Divisions → Lessons)
- Content Classification
- Exam Engine Core
- User Management
- Commercial Layer
- Media Library
- Communication Layer
- Backoffice Dashboard

This stage validates cross-module correctness and isolation.

It does not introduce new business logic.

---

## Validation Layers

Validation must occur at five layers.

---

### 1️⃣ Tenant Isolation Validation

Must verify strict database-per-tenant isolation (ADR-0001).

Required Tests:

- Cross-tenant data access attempt returns empty or forbidden
- Tenant connection pool scoped by workspace_slug
- No master_db access inside tenant services
- No shared table joins across tenants
- Workspace deletion does not affect other tenants

Failure immediately blocks stage.

---

### 2️⃣ Backend Integration Tests (Tenant DB + Engine)

Tools:

- Vitest
- Supertest
- Dockerized PostgreSQL (multi-tenant simulation)

Mandatory Scenarios:

1. Create Division → Department → Group → Subject → Lesson hierarchy
2. Create MCQ question → assign to basket → create exam config
3. Schedule exam → validate state machine transitions
4. Create staff → assign role → verify RBAC
5. Create students → enforce limit (limit engine test)
6. Plan purchase → subscription enforcement test
7. Promo code application → validation
8. Media upload → asset persistence
9. Notification trigger → event recorded
10. Attempt configuration consistency (no grading here)

All integration tests must use real tenant database instances.

No mocks allowed for DB-level validation.

---

### 3️⃣ Exam Engine Structural Validation

This stage validates configuration integrity only.

Must verify:

- Question schema correctness
- Exam config versioning
- Schedule boundaries
- Grading configuration completeness
- No snapshot mutation after publish
- Version compatibility checks enforced

Must confirm:

- Exam config cannot be modified while scheduled
- Deleting referenced entities fails safely
- Status workflow engine respects transitions

---

### 4️⃣ Backoffice UI E2E Validation

Recommended Tool:

- Playwright

Mandatory Flows:

1. Admin login
2. Create academic structure
3. Create question
4. Create exam
5. Schedule exam
6. Create staff member
7. Assign role
8. Create student
9. Apply plan
10. View dashboard metrics

UI Requirements:

- No console errors
- Proper loading states
- RBAC-enforced visibility
- Forbidden routes redirect correctly
- No raw backend errors exposed

All E2E flows must pass in CI.

---

### 5️⃣ Security & Abuse Validation

Must test runtime protection:

- Unauthorized role escalation attempt
- Expired JWT access
- Tampered token
- SQL injection in search fields
- SQL injection in filter parameters
- Rate-limit enforcement (if defined for tenant APIs)
- File upload abuse (invalid mime type)
- XSS attempt in text fields

Logs must redact:

- Tokens
- Password hashes
- Sensitive PII

Any vulnerability blocks stage.

---

### 6️⃣ Concurrency & Load Validation

Recommended Tool:

- k6

Required Tests:

1. Concurrent student creation (limit enforcement)
2. Concurrent exam scheduling
3. Concurrent role updates
4. Concurrent content classification updates

Must verify:

- No deadlocks
- No partial transactions
- Lock contention acceptable (< 10ms average)
- No inconsistent hierarchy states

---

## CI/CD Requirements

GitHub Actions must include:

1. Lint & TypeScript gate
2. Unit test gate
3. Integration test gate
4. E2E gate
5. Isolation validation suite
6. Security validation suite
7. Load test (nightly acceptable)
8. Coverage threshold gate

Merge blocked on failure.

---

## Required Artifacts

Upon completion, generate:

- TEST_REPORT.md
- Isolation validation report
- Load metrics summary
- E2E execution report
- Security validation checklist

Commit under:

reports/backoffice-system-validation/

---

## Failure Policy

If any validation fails:

- Phase 3 status reverts to BACKEND CLOSED
- Root cause documented
- Fix applied
- Entire stage re-run

Partial validation is not acceptable.

---

## Completion Criteria

This stage is complete when:

- All validation layers pass
- Isolation verified across tenants
- CI pipeline fully green
- Coverage thresholds satisfied
- No unresolved critical security issues
- No runtime state inconsistencies detected

When complete:

Phase 3 may be promoted from BACKEND CLOSED → PRODUCTION READY.

---

## Governance Rule

No Phase 4 (Runtime) expansion or Frontoffice integration may begin until this stage passes.

This stage acts as:

Phase 3 Exit Gate.

---

## Final Statement

This stage enforces full-stack tenant integrity across:

Tenant Database  
Academic Structure  
Exam Engine  
User Management  
Commercial Logic  
UI  
Security  
Concurrency

Without passing this stage, Backoffice is considered unstable.

---
