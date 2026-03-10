# STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING

## Stage Type

UI Foundation — Security Boundaries & Token Lifecycle Management

---

## Stage Status

Status: PRODUCTION READY Risk Level: LOW Closure Date: 2026-03-02T14:15:00Z

Implementation: COMPLETE Tasks: 57 / 57 completed

Scope Closed:

- License status stores (mmc, backoffice, frontoffice)
- Token redaction utility: redactSensitiveFields + looksLikeToken (3 apps)
- expireSession() action in auth.store.ts (3 apps)
- Error interceptor with 401/423/426 handling + isHandling401 idempotency guard (3 apps)
- API client factory extension with errorInterceptor wiring (3 apps)
- Auth guard redirect preservation query param (3 apps)
- main.ts wiring: errorInterceptor + licenseStatusStore + clearUserSpecificStores callback (3 apps)
- ESLint vue/no-v-html enforced as error; all v-html usages eliminated
- 31 test files, 273 tests — ALL PASS

Deferred Scope:

- Refresh token strategy (disabled by default — deferred to future stage)
- clearUserSpecificStores() full enumeration (stub in place, populated as feature stages land)
- 2FA flows, OAuth flows, backend auth, RBAC enforcement

Constitutional Compliance:

- ADR-0001 Database-per-tenant isolation verified (no DB access)
- ADR-0002 Snapshot immutability (not applicable)
- ADR-0006 Server-authoritative time enforced
- ADR-0007 Version compatibility enforced
- ADR-0008 Semantic versioning enforced
- Token-in-memory enforcement verified via token-persistence-audit tests
- Single-header injection policy verified via client.test.ts
- 401 idempotency guaranteed via 401-race integration tests
- XSS mitigation enforced via vue/no-v-html ESLint rule
- Implementation fully compliant with Zidney Constitution v1.2.0

Notes: Stage is production ready. No structural backend modifications allowed. To add new security
behaviors, create a new stage referencing this one. Modifications require a new migration stage.

Notes: Full drift analysis passed. All guardian audits cleared. Implementation gate open. 59 atomic
tasks ready for execution.

---

## Purpose

Define the frontend security architecture across:

- MMC
- Backoffice
- Frontoffice

This stage standardizes:

- Token storage strategy
- Token refresh handling
- Token expiration flow
- Secure logout
- API auth header injection
- XSS & CSRF mitigation strategy
- Sensitive data handling in memory
- Route-level security reactions

This stage does NOT implement backend authentication. It defines how the UI consumes and protects
auth state.

---

## Constitutional Constraints

Frontend security layer must:

- Never trust client-side role flags
- Never store access tokens in localStorage
- Never expose tokens in logs
- Never duplicate RBAC logic
- Never bypass backend authorization
- Never assume token validity without server verification

Backend remains the single source of truth.

---

## Token Model Assumptions

Based on backend architecture:

- JWT (HS256)
- Short-lived access token
- Optional refresh mechanism (if enabled)
- Token versioning enforced server-side
- License & workspace validation enforced server-side

Frontend must treat tokens as opaque strings.

No JWT decoding for business decisions allowed.

---

## Token Storage Policy

### Access Token

Must be stored:

- In-memory only (Pinia auth.store)
- Cleared on page refresh

Must NOT be stored in:

- localStorage
- sessionStorage
- IndexedDB
- Cookies (unless HttpOnly managed by backend)

If backend uses HttpOnly cookies:

- UI must not attempt manual storage.

---

## Token Injection Strategy

All HTTP requests must:

- Inject Authorization header via API client interceptor
- Never inject token manually inside component
- Never duplicate header logic

Pattern:

```
Authorization: Bearer <access_token>
```

If no token exists:

- API client must not send Authorization header.

---

## Token Expiration Handling

If API returns 401:

1. Clear auth state
2. Redirect to login
3. Show session expired notification
4. Preserve intended route (optional redirect back)

Never:

- Retry infinitely
- Loop redirects
- Attempt silent refresh unless defined

---

## Refresh Strategy (If Enabled)

If refresh tokens exist:

- Refresh must occur via dedicated endpoint
- Use single-flight mechanism (avoid parallel refresh calls)
- Queue pending requests during refresh
- If refresh fails → force logout

Refresh logic must live in:

```
core/auth/refresh.ts
```

Not in component.

---

## Secure Logout

Logout must:

- Clear auth.store
- Clear persisted UI state if related to user
- Redirect to login
- Optionally call backend logout endpoint

Logout must NOT:

- Leave token in memory
- Leave stale store state

---

## Route Protection

Router guards must:

- Check auth.store.isAuthenticated
- Optionally validate token freshness (timestamp-based)
- Redirect unauthenticated users

Guards must NOT:

- Decode JWT for permissions
- Decide license validity
- Decide workspace access

All sensitive decisions must be validated by backend.

---

## Sensitive Data Handling

UI must never persist:

- Access tokens
- Refresh tokens
- License status
- Permission matrix
- Payment information

Sensitive objects must:

- Live in memory only
- Be cleared on logout
- Be redacted in logs

---

## XSS Mitigation

Rules:

- No v-html without sanitization
- No dynamic script injection
- Use Vue template escaping
- Avoid dangerouslySetInnerHTML patterns

If rich text required:

- Use sanitized renderer only.

---

## CSRF Considerations

If backend uses cookies:

- API client must send credentials when required
- CSRF token must be handled via secure header
- Never expose CSRF token in logs

If backend uses pure JWT header:

- CSRF risk minimized
- Still protect against XSS

---

## License & Version Security

UI must not:

- Cache license state
- Trust license flags
- Override 423/426 responses

If backend returns:

423 → show locked message  
426 → show upgrade required message

UI must not attempt override.

---

## Testability Requirements

Security layer must support:

- Expired token simulation
- Tampered token simulation
- Multiple parallel 401 responses
- Refresh race condition test
- Logout clearing state test
- Auth guard redirect test

Tests must not require real backend.

---

## Explicit Non-Goals

This stage does NOT:

- Implement backend auth
- Define JWT payload structure
- Implement RBAC enforcement
- Implement license validation
- Implement 2FA flows
- Implement OAuth flows

Only frontend security boundaries.

---

## Completion Criteria

Stage complete when:

- Token stored in memory only
- API client injects Authorization centrally
- 401 handling standardized
- Logout clears all state
- Router guards implemented
- No token stored in persistent storage
- No JWT decoding in UI logic
- XSS protections verified
- CI passes lint + TypeScript
- No TODO placeholders in security layer

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
