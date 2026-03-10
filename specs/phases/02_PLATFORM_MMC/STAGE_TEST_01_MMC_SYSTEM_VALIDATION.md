# STAGE_TEST_01_MMC_SYSTEM_VALIDATION

Phase: 02_PLATFORM_MMC  
Type: Cross‑Stage Validation & Exit Gate  
Track: Backend + UI + Infrastructure

---

## Purpose

This stage validates the **entire MMC platform stack** after all Phase 2 backend and UI stages are
complete.

It is not a unit-test stage.

It is a **system validation gate** that ensures:

- Backend contracts are stable
- UI consumes contracts correctly
- Lifecycle engine behaves deterministically
- Provisioning behaves safely under concurrency
- RBAC and security protections hold under runtime conditions
- No drift exists between engine, API, and UI

This stage must pass before:

- Marking Phase 2 as PRODUCTION READY
- Beginning Phase 3 (Backoffice)

---

## Scope

Covers:

- Products
- Licenses
- License Lifecycle
- Provisioning Trigger
- Affiliates
- MMC Members & RBAC
- Dashboard
- Shared UI system integration

Does NOT modify business logic. Only validates.

---

## Test Architecture Layers

Validation must occur at 4 layers:

---

### 1️⃣ Unit Validation (Baseline)

Tools:

- Vitest (backend)
- Vue Testing Library (UI)

Must verify:

- Schema validation logic
- Commission calculations
- State machine transitions
- Permission evaluation
- Error mapping logic

All existing unit tests must pass.

Minimum Coverage Target:

- Backend ≥ 90%
- UI ≥ 80%

Failure blocks stage.

---

### 2️⃣ Integration Tests (API + Database)

Tools:

- Vitest
- Supertest
- Dockerized PostgreSQL (test container)

Required Scenarios:

1. Create Product → Verify Version
2. Create License → Verify Limits
3. Provision License → Registry Updated
4. Soft Lock → Access Restricted
5. Restore → Access Re-enabled
6. Archive → Workspace Inaccessible
7. Affiliate Apply → Commission Stored
8. RBAC Restriction → 403 returned
9. Duplicate Slug → 409 returned
10. Expired Affiliate → Rejected

Must test against real database instance (not mocked).

All integration tests must pass.

---

### 3️⃣ End-to-End (E2E) Browser Flows

Recommended Tool:

- Playwright

Browser Coverage:

- Chromium
- Firefox

Mandatory E2E Flows:

1. Admin Login
2. Create Product
3. Create License
4. Observe Provisioning Spinner
5. Soft Lock via UI
6. Restore via UI
7. Archive Confirmation Flow
8. Affiliate Creation & Application
9. Invite MMC Member
10. Dashboard Metrics Rendering

Validation Requirements:

- No console errors
- No uncaught promise rejections
- Proper loading states
- Correct error messages surfaced

All flows must pass in CI.

---

### 4️⃣ Security & Abuse Validation

Must execute runtime attack simulations against running API.

Required Tests:

- Expired JWT
- Tampered JWT
- Role escalation attempt
- SQL injection payload in slug
- SQL injection payload in promo_code
- Rate limit threshold exceeded (expect 429)
- Duplicate provisioning trigger
- Unauthorized lifecycle action (expect 403)

Logging must redact:

- Tokens
- Sensitive fields
- Raw SQL

Any vulnerability blocks stage.

---

### 5️⃣ Load & Concurrency Validation

Recommended Tool:

- k6

Minimum Load Scenarios:

1. 100 concurrent license creations
2. 50 concurrent lifecycle transitions
3. 50 concurrent provisioning triggers
4. Rate-limit burst test

Validation Metrics:

- Middleware latency < 5ms average
- No deadlocks
- No duplicate provisioning
- No partial state transitions
- Lock contention acceptable (< 10ms wait)

Failure blocks stage.

---

## CI/CD Pipeline Integration

GitHub Actions must include:

1. Lint & TypeScript check
2. Unit test stage
3. Integration test stage
4. E2E stage
5. Load test stage (nightly acceptable)
6. Migration safety gate
7. Coverage threshold gate

Merge must be blocked if any stage fails.

---

## Required Artifacts

Upon completion, this stage must generate:

- TEST_REPORT.md
- Coverage summary
- k6 performance report
- E2E execution report
- Security validation checklist

Reports must be committed under:

reports/mmc-system-validation/

---

## Failure Policy

If any test fails:

- Phase 2 status reverts to BACKEND CLOSED
- Root cause documented
- Fix applied
- Entire stage re-run

Partial passes are not allowed.

---

## Completion Criteria

This stage is complete when:

- All 4 validation layers pass
- CI pipeline fully green
- Coverage thresholds satisfied
- No open critical vulnerabilities
- No unhandled promise rejections in E2E
- No database inconsistencies after load tests

When complete:

Phase 2 may be promoted from BACKEND CLOSED → PRODUCTION READY.

---

## Governance Rule

No Phase 3 development may begin until this stage is fully complete.

This stage acts as:

Phase 2 Exit Gate.

---

## Final Statement

This stage enforces full-stack integrity across:

Backend  
UI  
Infrastructure  
Security  
Concurrency  
Observability

Without passing this stage, Phase 2 is considered unstable.

---
