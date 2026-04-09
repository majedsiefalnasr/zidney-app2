# STAGE_TEST_01_UI_RUNTIME_VALIDATION

Phase: 06_UI_APPLICATION_RUNTIME  
Type: Validation Stage  
Purpose: UI Runtime Integrity & Security Verification

---

## Stage Status

Status: BACKEND CLOSED
Step: implement
Risk Level: LOW
Last Updated: 2026-04-10T00:00:00.000Z

Implementation: COMPLETE
Tasks: 17 / 17 completed

Scope Closed:

- 6 coverage gaps addressed (G1–G6 traceability)
- 3 new test files: static-analysis.test.ts, correlation-id.test.ts, store-isolation.test.ts
- 6 extended test files: error-normalizer.spec.ts (×3), session-clear-wiring.test.ts (×3)
- Lint, typecheck, and all 3 production builds PASS
- 75/76 tests pass (1 expected fail: genuine raw fetch() violation found in backoffice)

Deferred Scope:

- Tests 8.2 and 8.3 (perf: interceptor overhead + re-render discipline) — deferred to future PERF stage
- `main.ts` `onSessionExpired` → `clearLicenseStatus()` call — deferred to PRODUCTION-PATCH stage
- Raw fetch() migration: 10 occurrences in backoffice production code → PRODUCTION-PATCH stage required

Architecture Governance Compliance:

- Architecture Guardian: PASS
- API Designer: PASS
- Security Auditor: PASS
- Performance Optimizer: PASS
- QA Engineer: PASS (after F1+F2 fixes)
- Code Reviewer: PASS (after CR1 fix)
- ADR alignment verified — implementation compliant

Notes:
Backend implementation complete. No structural backend modifications allowed.

---

# 1. OBJECTIVE

This stage validates the integrity, security, and architectural correctness of the UI Runtime layer
before Phase 06 can be marked VALIDATED.

This stage verifies foundational guarantees that apply to:

- MMC
- Backoffice
- Frontoffice

This is not a feature validation stage. This is a runtime integrity stage.

Failure in any section blocks promotion.

---

# 2. VALIDATION SCOPE

This stage validates:

- STAGE_UI_00_RUNTIME_ARCHITECTURE
- STAGE_UI_01_AUTH_MODULE
- STAGE_UI_02_API_CLIENT_LAYER
- STAGE_UI_03_ROUTER_AND_GUARDS
- STAGE_UI_04_GLOBAL_ERROR_HANDLING
- STAGE_UI_05_ENV_CONFIGURATION
- STAGE_UI_06_STATE_MANAGEMENT
- STAGE_UI_07_LAYOUT_SYSTEM_INTEGRATION
- STAGE_UI_08_NOTIFICATION_AND_FEEDBACK
- STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING

---

# 3. AUTHENTICATION & TOKEN VALIDATION

## 3.1 Expired Token Handling

- Simulate expired token
- Expect automatic logout + redirect to login
- No infinite retry loops

## 3.2 Tampered Token Handling

- Modify token payload locally
- Expect 401 response handling + logout

## 3.3 Cross-Workspace Token Isolation

- Use token from workspace A against workspace B
- Expect rejection

## 3.4 Token Storage Policy

- Verify token storage mechanism matches policy
- Confirm no sensitive token logged

---

# 4. ROUTER & GUARD VALIDATION

## 4.1 Route Protection

- Access protected route while unauthenticated
- Expect redirect to login

## 4.2 Role-Based Guards

- Access admin-only route as non-admin
- Expect denial

## 4.3 License State Handling

- Simulate 423 (SOFT_LOCKED)
- Simulate 426 (UPGRADE_REQUIRED)
- Ensure global handler redirects or displays correct state

---

# 5. API CLIENT LAYER VALIDATION

## 5.1 Centralized Client Enforcement

- Confirm no direct fetch/axios usage outside API client

## 5.2 Global Error Mapping

Verify handling for:

- 401 Unauthorized
- 403 Forbidden
- 423 Locked
- 426 Upgrade Required
- 429 Rate Limit
- 500 Internal Error

## 5.3 Correlation ID Propagation

- Confirm request_id header passed if required

---

# 6. GLOBAL ERROR HANDLING

## 6.1 RFC 7807 Parsing

- Validate error normalization
- Ensure safe user-facing message
- Internal fields not exposed

## 6.2 Unknown Error Fallback

- Simulate network failure
- Ensure generic fallback screen

---

# 7. STATE MANAGEMENT VALIDATION

## 7.1 Store Isolation

- Ensure each app has isolated store instance

## 7.2 Logout Reset

- On logout, verify state cleared

## 7.3 No Business Logic in Components

- Confirm API calls occur only in service layer

---

# 8. ENVIRONMENT CONFIGURATION

## 8.1 Environment Separation

- Dev and production API URLs differ
- No secrets in client bundle

## 8.2 Build Integrity

- Production build succeeds
- No runtime errors in console

---

# 9. SECURITY VALIDATION

## 9.1 XSS Surface Check

- Basic script injection test in input components
- Confirm rendering sanitized

## 9.2 Logging Redaction

- Confirm tokens not printed in logs

---

# 10. PERFORMANCE BASELINE

- Router navigation < 50ms average
- API client overhead minimal
- No unnecessary re-renders in core layout

---

# 11. PASS CRITERIA

This stage is PASSED when:

- All validation scenarios succeed
- No token leakage detected
- No route bypass possible
- No global error inconsistencies
- State isolation verified
- Production build clean

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0

---
