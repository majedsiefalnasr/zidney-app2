# STAGE_UI_09 — Security and Token Handling

**Phase**: 06_UI_APPLICATION_RUNTIME  
**Stage**: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING  
**Status**: DRAFT  
**Created**: 2026-03-01  
**Constitution Version**: 1.2.0

---

## Feature Overview

This stage defines the frontend security architecture shared across all three UI applications: **MMC**, **Backoffice**, and **Frontoffice**. It standardises how authentication tokens are stored, transported, expired, and cleared — and how each application protects users and data from common web vulnerabilities.

**In scope:**

- Token storage policy (where and how access tokens live in the browser)
- Authorization header injection (how every API request carries the token)
- Session expiry handling (what happens when the server rejects a request as unauthorized)
- Secure logout (how all auth state is cleaned up when a user signs out)
- Route-level access guarding (how unauthenticated users are redirected)
- XSS and CSRF mitigation strategy for the frontend layer
- Frontend reactions to license-locked (423) and upgrade-required (426) responses

**Not in scope:**

- Backend authentication implementation
- JWT payload structure or signing algorithm
- RBAC enforcement (server-side only)
- License validation logic (server-side only)
- Two-factor authentication flows
- OAuth / social login flows

**Applications affected:** MMC, Backoffice, Frontoffice  
**Backend dependency:** None — this stage only defines how the UI _consumes and protects_ auth state already provided by the backend.

---

## Constitutional Compliance Declaration

| Principle                              | Status       | Notes                                                                         |
| -------------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| No cross-tenant access                 | ✅ Compliant | UI holds no tenant DB knowledge; tenant context is resolved solely by backend |
| No middleware bypass                   | ✅ Compliant | UI cannot and does not bypass backend middleware                              |
| No grading outside Worker              | ✅ Compliant | No grading logic exists in this stage                                         |
| No direct DB instantiation             | ✅ Compliant | No database access from UI                                                    |
| Snapshot integrity preserved           | ✅ Compliant | No attempt engine involvement in this stage                                   |
| Server-authoritative time              | ✅ Compliant | UI does not make timing decisions; all expiry decisions are server-driven     |
| No JWT decoding for business decisions | ✅ Compliant | Tokens are treated as opaque strings                                          |
| RBAC server-side only                  | ✅ Compliant | No permission checks in UI code                                               |
| Separation of layers                   | ✅ Compliant | All security logic lives in `core/auth/`, not in components                   |
| Structured logging with correlation ID | ✅ Compliant | Auth events logged via the shared logger; no `console.log`                    |

No ADR exceptions are required for this stage.

---

## Isolation Impact Analysis

This is a pure frontend stage. No database access occurs.

| Item                    | Value                                                               |
| ----------------------- | ------------------------------------------------------------------- |
| Database accessed       | None                                                                |
| Tenant resolution       | Backend concern only; UI receives a resolved token from the backend |
| Connection pool         | Not applicable                                                      |
| New tables introduced   | None                                                                |
| Shared tenant data risk | None — UI holds no persistent cross-user state                      |

Database-per-tenant isolation is preserved. This stage cannot weaken it.

---

## License & Version Enforcement

The UI does not enforce license logic. It **reacts** to authoritative backend responses:

| Backend Response       | UI Behaviour                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `423 Locked`           | Display workspace-locked message; do not attempt override or retry |
| `426 Upgrade Required` | Display upgrade-required message; do not attempt override or retry |
| `403 Forbidden`        | Display access denied message; do not cache or suppress            |
| `404 Not Found`        | Treat as normal not-found; do not infer workspace status           |

The UI must **never**:

- Cache license status flags
- Store or decode license state from the token
- Trust any locally stored license flag
- Attempt to bypass or override 423/426 responses

License middleware on the backend remains mandatory. The UI is a passive consumer of its output.

---

## Token Storage Policy

### Access Token

| Storage Location                  | Permitted                                                             |
| --------------------------------- | --------------------------------------------------------------------- |
| Pinia auth store (in-memory)      | ✅ Yes                                                                |
| `localStorage`                    | ❌ Never                                                              |
| `sessionStorage`                  | ❌ Never                                                              |
| `IndexedDB`                       | ❌ Never                                                              |
| Browser cookie (UI-managed)       | ❌ Never                                                              |
| HttpOnly cookie (backend-managed) | Permitted if backend controls it — UI makes no manual storage attempt |

**Consequence of in-memory storage:** the token is cleared on page refresh, which is the intended behaviour. Users must re-authenticate after a full page reload unless the backend provides an alternative session mechanism (outside scope of this stage).

### Token Treatment

Tokens must be treated as **opaque strings** at all times. The UI must not:

- Base64-decode or JSON-parse the token payload
- Read claims (sub, exp, roles, workspace) from the token for any business decision
- Log the token value in full or partial form
- Expose the token to third-party scripts or analytics tools

---

## Authorization Header Injection

Every outbound HTTP request to the Zidney API must carry the access token in the `Authorization` header. This injection must be **centralised in the API client interceptor**.

**Required header format:**

```
Authorization: Bearer <access_token>
```

**Rules:**

- Header injection must occur in a single place (API client request interceptor), never inside individual components or composables.
- If no token is present in the auth store, the interceptor must omit the `Authorization` header entirely — it must not send `Bearer undefined` or `Bearer null`.
- No component may manually construct or append an `Authorization` header.
- No service layer may duplicate header injection logic.

This ensures the token lifecycle is managed in one place and any future changes (e.g., switching token types) affect only the interceptor.

---

## Session Expiry and 401 Handling

When the API returns a `401 Unauthorized` response, the UI must follow a **standardised, non-retrying flow**:

1. Clear the auth store (token, user identity, session metadata)
2. Clear any user-specific UI state that was derived from the authenticated session
3. Redirect the user to the login page
4. Display a "Session expired — please sign in again" notification
5. Optionally preserve the originally intended route so the user can be redirected back after successful re-authentication

**Prohibited behaviours:**

- Infinite retry loops on 401
- Silent retry without user notification
- Redirect loops (guard → 401 → guard)
- Attempting a token refresh unless a refresh strategy is explicitly enabled (see Refresh Strategy section)
- Ignoring a 401 and allowing the user to continue in a broken authenticated state

All 401 interception logic must reside in the API client response interceptor — not in individual page components.

---

## Refresh Strategy

Token refresh is **conditional**. It must only be implemented if the backend provides a refresh token mechanism.

**When refresh is enabled:**

| Rule                      | Requirement                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Refresh endpoint          | Dedicated endpoint provided by backend; UI does not construct refresh logic                                                        |
| Single-flight enforcement | Only one refresh request may be in-flight at any time; parallel refresh calls must be queued and resolved from the single response |
| Request queuing           | Requests that arrive during an in-flight refresh must be held and replayed after refresh succeeds                                  |
| Refresh failure           | If the refresh call returns any non-success response, the full logout flow must execute immediately                                |
| Refresh logic location    | Must reside in `core/auth/refresh.ts` — not in any component, page, or composable                                                  |

**When refresh is disabled (default):**

A 401 immediately triggers the standard expiry flow: clear state, redirect to login.

**Prohibited in both cases:**

- Trusting a client-side expiry timer as the signal to refresh (client time is not authoritative)
- Decoding the token `exp` claim to schedule a refresh
- Refreshing speculatively without a 401 trigger

---

## Secure Logout

Logout is a critical security boundary. When a user initiates logout, the following must occur atomically from the user's perspective:

1. The auth store is cleared (access token, user identity, workspace context, session metadata)
2. All user-specific persisted UI state (preferences, cached view data tied to the user) is cleared
3. The user is redirected to the login page
4. Optionally, a backend logout endpoint is called to invalidate the server-side session (fire-and-forget; UI logout is not blocked by backend response)

**Logout must never:**

- Leave the access token accessible in the Pinia store
- Leave stale user data in memory that would be visible to the next user on a shared machine
- Redirect to a page that requires authentication (which would immediately trigger another redirect)
- Partially clear state and consider the user logged out

**Logout trigger locations:**

- Manual logout action by the user (navigation menu, profile dropdown)
- Automatic logout triggered by the 401 handling flow
- Session expiry notification action

---

## Route Protection

All protected routes must be guarded at the router level. Guards must enforce the following:

| Check                    | Allowed                                                                   | Not Allowed                        |
| ------------------------ | ------------------------------------------------------------------------- | ---------------------------------- |
| Is user authenticated?   | ✅ Check `auth.store.isAuthenticated`                                     | ❌ Decode JWT claims               |
| Redirect unauthenticated | ✅ Redirect to login                                                      | ❌ Allow access to protected route |
| Token freshness check    | ✅ Compare timestamp of last auth (optional, server-round-trip preferred) | ❌ Decode `exp` claim from JWT     |
| Permission check         | ❌ Not in guards                                                          | ❌ Not in guards                   |
| License validity check   | ❌ Not in guards                                                          | ❌ Not in guards                   |
| Workspace access check   | ❌ Not in guards                                                          | ❌ Not in guards                   |

All decisions beyond "is a token present?" must be validated by backend responses, not by guard logic.

---

## XSS Mitigation

The frontend must rely on Vue's built-in template escaping as the primary XSS defence.

**Mandatory rules:**

| Rule                                       | Enforcement                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| No `v-html` without sanitization           | All uses of `v-html` must pass content through an approved sanitization function before rendering |
| No dynamic `<script>` injection            | No runtime script tag creation via JavaScript                                                     |
| No `eval()` or `Function()` with user data | Forbidden in all UI application code                                                              |
| No bypassing Vue's template compiler       | All templates must go through the standard Vue compilation pipeline                               |
| Third-party rich text content              | Must be rendered through a sanitized renderer only                                                |

If a product feature requires rendering user-generated HTML (e.g., exam question rich text), the owning stage must specify the approved sanitization library and policy. This stage establishes the baseline rule.

---

## CSRF Considerations

CSRF risk depends on the authentication transport the backend uses:

| Backend Auth Transport              | CSRF Requirements                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Pure JWT bearer header (no cookies) | CSRF risk is minimised; standard header-based protection applies                                                                          |
| HttpOnly cookie (backend-managed)   | API client must send `credentials: include`; CSRF token must be handled via a secure request header; CSRF token must never appear in logs |

Regardless of transport, the UI must never expose CSRF tokens in logs, state, or to third-party scripts.

---

## Sensitive Data Handling

The following data types must never be persisted to any browser storage:

- Access tokens
- Refresh tokens
- License status flags
- Permission matrices
- Payment information
- Personally identifiable information beyond what the current view requires

**Rules for in-memory sensitive data:**

- Must be cleared on logout (not just on page navigation)
- Must be redacted or omitted in structured logs
- Must not be exposed to analytics, error monitoring, or third-party tools without explicit scrubbing

---

## Security Logic Placement

All authentication and security logic must reside in `core/auth/`. No component, page, or layout may contain auth logic directly.

| Responsibility             | Location                                                         |
| -------------------------- | ---------------------------------------------------------------- |
| Auth store definition      | `core/auth/auth.store.ts`                                        |
| Token refresh logic        | `core/auth/refresh.ts`                                           |
| Logout action              | `core/auth/logout.ts`                                            |
| 401 response interceptor   | `core/auth/interceptors.ts` (or equivalent in API client config) |
| Router guard logic         | `core/auth/guards.ts`                                            |
| Input sanitization helpers | `core/security/sanitize.ts`                                      |

Components must call auth store actions; they must not replicate auth logic inline.

---

## User Scenarios and Acceptance Criteria

### Scenario 1: User logs in and navigates to a protected route

**Given** a user has successfully authenticated  
**When** they navigate to any protected area  
**Then** the auth store holds the token in memory and the API client injects the Authorization header on all subsequent requests

**Acceptance:** All API requests from the session carry the correct Authorization header without any component-level intervention.

---

### Scenario 2: User's session expires mid-use

**Given** a user is actively using the application  
**When** the API returns a 401 response to any request  
**Then** the auth state is cleared, the user is redirected to login, and a "session expired" message is displayed

**Acceptance:** No component triggers the expiry flow independently; it is handled once by the response interceptor. No redirect loops occur.

---

### Scenario 3: User logs out

**Given** a user is authenticated  
**When** they trigger the logout action  
**Then** the auth store is cleared, user-specific UI state is cleared, and the user is redirected to login

**Acceptance:** After logout, no token or user data remains accessible in the Pinia store. Revisiting a protected route redirects to login.

---

### Scenario 4: Page is refreshed

**Given** a user has an active in-memory session  
**When** they refresh the browser  
**Then** the token is lost (in-memory only), the user is redirected to login on next protected route visit

**Acceptance:** No token survives a page refresh. The behaviour is deliberate and documented.

---

### Scenario 5: Backend returns 423 Locked

**Given** a workspace has been soft-locked by the platform  
**When** the API returns 423  
**Then** the UI displays a locked message and does not attempt to override, retry, or cache the response

**Acceptance:** 423 responses always result in a user-visible locked state message. No retry occurs.

---

### Scenario 6: Unauthenticated user accesses a protected route

**Given** no authentication token exists in the auth store  
**When** a user attempts to access a protected route directly (e.g., via URL)  
**Then** the router guard redirects them to the login page

**Acceptance:** No protected page is rendered without a valid in-memory token. Redirect preserves the intended destination for post-login return.

---

### Scenario 7: Malicious HTML in user-provided content

**Given** a field displays user-provided or externally-sourced content  
**When** that content contains HTML or script tags  
**Then** Vue's template escaping prevents execution; `v-html` is only used with sanitized content

**Acceptance:** No unsanitized HTML is rendered via `v-html` anywhere in the codebase. Linting enforces this where tooling allows.

---

## Functional Requirements

### Token Storage

- **FR-SEC-01**: The access token must be stored exclusively in the in-memory Pinia auth store.
- **FR-SEC-02**: The access token must never be written to `localStorage`, `sessionStorage`, `IndexedDB`, or any browser-managed cookie by UI code.
- **FR-SEC-03**: Tokens must not appear in structured logs in full or partial form.

### Authorization Header Injection

- **FR-SEC-04**: The API client must inject the `Authorization: Bearer <token>` header on all requests to the Zidney API via a single centralised interceptor.
- **FR-SEC-05**: If no token is present, the interceptor must omit the Authorization header entirely.
- **FR-SEC-06**: No component, composable, or service may manually append an Authorization header.

### 401 Handling

- **FR-SEC-07**: Any 401 response from the API must trigger the standard expiry flow: clear auth store → clear user UI state → redirect to login → show session-expired notification.
- **FR-SEC-08**: The 401 handling must be idempotent — multiple concurrent 401 responses must not produce multiple redirects or multiple logout executions.
- **FR-SEC-09**: The intended pre-expiry route must optionally be preserved for post-login redirect.

### Logout

- **FR-SEC-10**: Logout must clear the auth store including the access token, user identity, and all session metadata.
- **FR-SEC-11**: Logout must clear all user-specific UI state stored in Pinia or component memory.
- **FR-SEC-12**: After logout, the user must be redirected to the login page.
- **FR-SEC-13**: Logout must execute completely regardless of whether the optional backend logout endpoint is reachable.

### Route Guards

- **FR-SEC-14**: All protected routes must be covered by router-level authentication guards.
- **FR-SEC-15**: Guards must check `auth.store.isAuthenticated` only; they must not decode JWT claims or check permissions.
- **FR-SEC-16**: Unauthenticated access to a protected route must redirect to login.

### XSS Mitigation

- **FR-SEC-17**: `v-html` must only be used when content has been processed through an approved sanitization function.
- **FR-SEC-18**: Dynamic script injection is prohibited.
- **FR-SEC-19**: All user-facing content must be rendered through Vue's template system by default.

### License Response Handling

- **FR-SEC-20**: A 423 response must display a workspace-locked message; no retry or override is permitted.
- **FR-SEC-21**: A 426 response must display an upgrade-required message; no retry or override is permitted.

### Security Logic Placement

- **FR-SEC-22**: All authentication and session security logic must reside in `core/auth/`; none may be inlined in components.

---

## Success Criteria

| Criterion                               | Measure                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Token never in persistent storage       | Zero occurrences of token write to localStorage/sessionStorage/IndexedDB found in codebase audit   |
| Single-point header injection           | Exactly one location in the codebase injects the Authorization header                              |
| Consistent 401 behaviour                | All 401 responses result in the same standardised flow regardless of which endpoint triggered them |
| No JWT decoding in UI                   | No JWT decode, base64 decode, or claim extraction from token found in UI codebase                  |
| XSS surface minimised                   | All `v-html` usages pass sanitization; confirmed by code review and linting                        |
| Logout is complete                      | Post-logout inspection of Pinia store shows empty auth state                                       |
| Route guards cover all protected routes | All routes requiring authentication are guarded; confirmed by router configuration audit           |
| No RBAC logic in UI                     | No permission-condition branches in UI code derived from token claims                              |
| CI passes                               | Lint and type check pass with zero auth-related violations                                         |
| No TODO placeholders in security layer  | Security logic in `core/auth/` contains no unresolved TODO comments                                |

---

## Assumptions

1. The backend issues a JWT-format access token, but the UI treats it as an opaque string — no decoding occurs.
2. Token refresh is disabled by default. If the backend enables a refresh endpoint in a future stage, `core/auth/refresh.ts` will be activated following the policy in this spec.
3. The backend manages its own authentication endpoints; this stage covers only the UI boundary.
4. HttpOnly cookies are not used in the current implementation. If the backend switches to HttpOnly cookies, the token storage policy section must be revisited via a new stage.
5. "User-specific UI state" refers to any Pinia store slice that is populated as a result of an authenticated session (e.g., user profile, workspace preferences, cached exam lists). Global, non-user-specific UI state (e.g., theme preference) is out of scope for logout clearing.
6. The sanitization library for `v-html` use cases will be specified per feature that requires rich text rendering; this stage establishes the baseline rule only.

---

## Explicit Non-Goals

- Backend authentication design (JWT structure, signing, token issuance)
- RBAC implementation (server-side only)
- License validation logic (server-side only)
- Two-factor authentication
- OAuth / social login
- Database access or tenant isolation (backend concerns)
- Token encryption at rest (not applicable for in-memory storage)
- Content Security Policy header management (server/infrastructure concern)

---

## Test Strategy

All security layer behaviour must be testable without a real backend connection. Tests must use mock API responses.

| Test Category                      | Coverage Required                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| Unit — auth store                  | Token set/clear, isAuthenticated flag, logout action                               |
| Unit — API interceptor             | Authorization header injected when token present; header absent when no token      |
| Unit — 401 handler                 | State cleared, redirect triggered, notification shown; idempotent on multiple 401s |
| Unit — router guards               | Unauthenticated redirect; authenticated pass-through                               |
| Unit — refresh (if enabled)        | Single-flight enforcement; queue replayed on success; logout triggered on failure  |
| Unit — sanitization helper         | Known XSS vectors are neutralised                                                  |
| Integration — logout flow          | All stores cleared; redirect occurs; accessing protected route redirects to login  |
| Integration — 401 race condition   | Multiple simultaneous 401 responses produce exactly one redirect                   |
| Integration — 423/426 handling     | Correct message displayed; no retry attempted                                      |
| Security — token persistence audit | No token survives page navigation to localStorage/sessionStorage                   |

All tests must pass in CI without network access to a live backend.
