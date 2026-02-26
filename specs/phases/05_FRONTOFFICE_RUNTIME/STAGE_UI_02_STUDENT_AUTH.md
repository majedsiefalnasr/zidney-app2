# STAGE_UI_02_STUDENT_AUTH

Phase: 05_FRONTOFFICE_RUNTIME  
Layer: Frontend (Vue 3 + Phase 6 Runtime Core)  
Status: DRAFT  
Depends On:

- STAGE_UI_01_FRONTOFFICE_SHELL
- PHASE_1_AUTHENTICATION_SYSTEM
- PHASE_6_UI_APPLICATION_RUNTIME (Security + API Client + State Management)

---

## Objective

Implement secure, student-only authentication flows for the Frontoffice.

This stage defines:

- Login flow
- Logout flow
- Token lifecycle handling
- Session restoration
- Auth state persistence
- Role validation (student)
- Expiration handling

This stage does **not** implement subscription enforcement logic.  
It only establishes identity and session state.

---

## Architectural Principle

Authentication is:

- Server-authoritative
- Token-based (JWT)
- Workspace-scoped
- Role-scoped

Frontend must:

- Validate presence of token
- Handle expiration
- Redirect on invalid session

Frontend must NOT:

- Trust local token blindly
- Infer role without backend validation
- Decode token for business logic decisions
- Store sensitive credentials insecurely

---

## Login Flow

### Route

`/login`

### Inputs

- Email or username
- Password

Optional (future):

- MFA / 2FA input

---

### Login Execution Flow

1. Submit credentials to:
   `POST /v1/frontoffice/auth/login`

2. Backend validates:
   - Workspace
   - Role = student
   - License state
   - Account lock state

3. On success:
   - Access token returned
   - Optional refresh token (if implemented)
   - Student profile payload

4. Frontend must:
   - Store token securely
   - Initialize auth store
   - Initialize workspace context
   - Redirect to `/dashboard`

---

## Token Storage Strategy

Preferred:

- httpOnly cookie (secure, sameSite=strict)

Alternative (if required by architecture):

- In-memory store + silent refresh
- Never plain localStorage without encryption strategy

Forbidden:

- Storing refresh tokens in localStorage
- Logging tokens
- Exposing tokens in URL

---

## Session Restoration

On application mount:

1. Check for existing token
2. Validate token via:
   `GET /v1/frontoffice/auth/me`
3. If valid:
   - Restore auth store
   - Restore workspace context
4. If invalid:
   - Clear session
   - Redirect to login

Auth must resolve before shell mounts protected routes.

---

## Logout Flow

Trigger:

- Manual logout
- Token expiration
- 401 response
- Workspace mismatch
- Security event

Logout must:

- Clear auth store
- Clear workspace store
- Clear sensitive state
- Redirect to `/login`

No partial logout allowed.

---

## Role Enforcement

Frontend must verify:

- Role returned from backend = student

If role mismatch:

- Immediate logout
- Log security event
- Redirect to login

No role-based conditional rendering without backend confirmation.

---

## Token Expiration Handling

If backend returns:

- 401 → invalid or expired token
- 403 → forbidden access

Frontend must:

- Intercept via global API interceptor
- Trigger logout
- Show session-expired message
- Redirect to login

Silent failure is not allowed.

---

## Auth Store Design

Centralized in Pinia:

State:

- isAuthenticated
- studentId
- workspaceSlug
- tokenStatus
- role
- profileData

Actions:

- login()
- logout()
- restoreSession()
- handleTokenExpired()

Getters:

- isStudent
- isSessionValid

No component-level auth state duplication.

---

## Security Hardening

Must include:

- Brute-force protection (backend)
- Account lock feedback
- Generic error messages (no user enumeration)
- Delay on failed login (handled backend)
- CSRF mitigation if cookie-based auth

Frontend must:

- Never reveal if email exists
- Never differentiate error messages
- Display generic “Invalid credentials”

---

## Error Handling

Login errors must handle:

- Invalid credentials
- Account locked
- License archived
- Workspace not found
- Rate limit exceeded

Errors must follow RFC 7807 structure.

Frontend must map:

- 429 → Show rate-limit message
- 423 → Show account locked message
- 403 → Show access forbidden message

---

## Accessibility Requirements

- Keyboard-accessible form
- Clear focus states
- Error messages associated with inputs
- Screen reader compatible labels
- Loading state with aria-busy

---

## Observability

Frontend must log:

- login_attempt
- login_success
- login_failure
- logout_triggered
- token_expired

Logs must include:

- workspace_slug (if known)
- request_id (if available)
- No sensitive data

---

## Failure Conditions

Stage fails if:

- Token stored insecurely
- Login works without backend validation
- Expired token not handled
- Role mismatch not handled
- Session persists after logout
- Deep-link bypass possible

---

## Exit Criteria

Stage complete when:

- Login functional
- Logout functional
- Token restoration working
- Route guards integrated
- Expiration handled
- Role enforcement confirmed
- No console errors
- Security review passed

Upon completion:

Frontoffice identity layer is stable and ready for Dashboard stage.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
