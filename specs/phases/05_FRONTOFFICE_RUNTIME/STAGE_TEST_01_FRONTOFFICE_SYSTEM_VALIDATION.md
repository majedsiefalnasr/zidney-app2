# STAGE_TEST_01_FRONTOFFICE_SYSTEM_VALIDATION

Phase: 05_FRONTOFFICE_RUNTIME  
Layer: Cross‑Layer Validation (Frontend + Backend + Runtime)  
Status: DRAFT  
Depends On:

- All Frontoffice backend stages (59–67)
- All Frontoffice UI stages (STAGE_UI_01 → STAGE_UI_10)
- Phase 04 Runtime stability

---

## Objective

This stage validates the entire Frontoffice system end‑to‑end.

It ensures:

- Student authentication works correctly
- Subscription enforcement is consistent
- Attempt runtime behaves safely
- Results and certificates are accurate
- Ads and Live sessions respect access rules
- No frontend bypass of backend enforcement exists

This stage is mandatory before marking Phase 05 as PRODUCTION READY.

---

# Validation Scope

This stage validates:

1. Authentication flow
2. Dashboard rendering
3. Library visibility rules
4. Attempt runtime integrity
5. Results & certificate rendering
6. Subscription & access gates
7. Notifications
8. Live sessions
9. Ads runtime
10. Cross‑tenant isolation

---

# Testing Strategy

Testing must include 4 layers:

---

## 1️⃣ Unit Tests (Frontend)

Tools Recommended:

- Vitest
- Vue Testing Library
- MSW (Mock Service Worker)

Validate:

- Component rendering
- Access state rendering logic
- Disabled buttons for locked states
- Token refresh logic
- Error boundary rendering

Target Coverage:

- ≥ 85% for Frontoffice UI

---

## 2️⃣ Integration Tests (Frontend + API Mock)

Validate:

- Auth login → dashboard load
- Library visibility filtering
- Subscription lock behavior
- Join live session button behavior
- Ads rendering suppression

Must simulate:

- 401 responses
- 403 responses
- Expired tokens
- Network failures

---

## 3️⃣ End‑to‑End Tests (Critical)

Recommended Tool:

- Playwright (preferred for multi‑browser)

Minimum Required Scenarios:

### Auth

- Student login success
- Invalid credentials
- Expired token auto logout

### Dashboard

- Dashboard loads correctly
- Restricted data not visible

### Library

- Student sees only allowed subjects
- Subscription locked content hidden

### Attempt Runtime

- Start attempt
- Autosave answers
- Reconnect after refresh
- Submit attempt
- Result shown

### Access Control

- Student from Workspace A cannot access Workspace B
- Locked subscription blocks attempt start
- Expired session blocks API calls

### Live Sessions

- Upcoming session visible
- Join only when AVAILABLE
- Join blocked when NOT_STARTED

### Ads

- Ads suppressed for premium
- Impression tracked
- HTML ad sanitized

---

## 4️⃣ Security Validation Tests

Must validate:

- SQL injection attempts rejected
- JWT tampering rejected
- Cross‑workspace access blocked
- Local storage token theft scenario simulated
- XSS attempt inside ad HTML blocked

---

# Performance Validation

Minimum Requirements:

- Dashboard load < 500ms
- Attempt autosave < 200ms
- API latency stable under 100 concurrent users
- No memory leak in attempt runtime

Use:

- Lighthouse (frontend performance)
- k6 or Artillery (API load)

---

# Isolation Validation

Mandatory checks:

- Workspace A cannot see Workspace B data
- API responses scoped by workspace_slug
- Student token from A rejected in B

Failure in isolation = BLOCKER.

---

# Observability Validation

Confirm logs include:

- request_id
- workspace_slug
- student_id
- route_name

Confirm:

- No token leakage in logs
- No PII leakage in ad events

---

# Accessibility Validation

Minimum:

- Lighthouse accessibility ≥ 90
- Keyboard navigation works
- Screen reader labels correct

---

# Failure Conditions

Phase fails if:

- Any cross‑tenant leakage occurs
- Attempt runtime inconsistent after refresh
- Subscription gate bypass possible
- JWT can be reused after logout
- HTML ad executes script
- Production console errors present

---

# Exit Criteria

Phase 05 can be marked PRODUCTION READY only when:

- All E2E tests pass
- All isolation tests pass
- Performance targets met
- Security validation passed
- No critical accessibility violations
- No high severity vulnerabilities

---

# Deliverables

This stage must produce:

- E2E test suite
- Security test suite
- Performance report
- Validation summary report

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0

---
