# STAGE_UI_01_AUTH_MODULE

## Stage Type

UI Foundation — Authentication Runtime Module

---

## Stage Status

Status: DRAFT
Risk Level: MEDIUM
Last Updated: 2026-03-01T00:30:00Z

Scope Planned:

- 18 new files (6 per app × 3 apps)
- 12 modified files (4 per app × 3 apps: client.ts, main.ts, router/index.ts, auth/index.ts)
- 3 deleted files (token-store.ts superseded)
- Bootstrap sequence locked (9-step ordering enforced)
- Single-flight refresh manager (factory injection pattern)
- Auth store with lazy refreshManager accessor (avoids creation-order circular dep)
- API client interceptors wired from Stage 00 stubs
- 37 unit/integration test cases planned

Deferred Scope:

- Login/Registration UI pages
- RBAC / RoleGuard implementation
- WorkspaceGuard (Backoffice feature stage)
- 2FA / MFA UI

Constitutional Compliance:

- Technical plan compliant — task generation authorized
- Both guardian verdicts: PASS
- HIGH-01, MEDIUM-01, MEDIUM-03 resolved before plan finalized

Notes:
Technical plan complete. Task breakdown in progress.

---

## Purpose

Define the canonical frontend authentication architecture shared across:

- MMC (Platform Admin)
- Backoffice (Tenant Admin)
- Frontoffice (Student)

This stage implements:

- Session model (UI-side)
- Access token lifecycle
- Refresh flow orchestration
- Logout mechanics
- Auth guards integration
- Auth state store

This stage does NOT implement login UI pages.
It defines the runtime auth engine behind them.

---

## Constitutional Constraints

The frontend authentication layer must:

- Never validate passwords
- Never issue tokens
- Never trust client time
- Never enforce business rules
- Never store secrets insecurely
- Never decode JWT to infer permissions (RBAC comes from backend)

Authentication is server-authoritative.

---

## Session Model

### Token Model

Frontend assumes backend provides:

- Access Token (short-lived, JWT)
- Refresh Token (httpOnly cookie)

Frontend must:

- Store access token in memory only
- Never store refresh token in JS
- Never persist tokens in localStorage (unless ADR approved)

---

### Auth State Store (Pinia)

Location:

```
core/state/auth.store.ts
```

Responsibilities:

- isAuthenticated (boolean)
- user (minimal profile only)
- accessToken (in-memory)
- loading state
- login()
- logout()
- refresh()

Rules:

- No direct HTTP in components
- Store uses API client only
- No permission logic inside store

---

## Token Lifecycle Flow

### Login Flow (Conceptual)

1. Login form submits credentials
2. Backend returns:
   - access token (body)
   - refresh token (httpOnly cookie)
3. Auth store stores access token in memory
4. Router redirects

Frontend never touches refresh token directly.

---

### Request Flow

1. API client attaches access token in Authorization header
2. If 401 returned:
   - Trigger refresh()
   - Retry original request (single-flight lock)

---

### Refresh Flow (Single-Flight)

Rules:

- Only one refresh request at a time
- Pending requests await refresh resolution
- If refresh fails → force logout
- No infinite retry loops

Implementation location:

```
core/auth/refresh-manager.ts
```

---

### Logout Flow

Logout must:

1. Call backend logout endpoint (invalidate session)
2. Clear access token (memory)
3. Reset auth store
4. Redirect to login route

No silent logout.

---

## Guard Integration

Auth module integrates with:

```
core/router/guards/auth.guard.ts
```

Guard rules:

- If route requiresAuth and not authenticated → redirect
- If authenticated and visiting login page → redirect to dashboard
- Guards must not decode JWT manually

---

## Folder Structure

```
core/
  auth/
    refresh-manager.ts
    token-manager.ts
  state/
    auth.store.ts
  guards/
    auth.guard.ts
```

No auth logic allowed outside core/.

---

## Security Rules

- No console.log of tokens
- No token exposure in error logs
- No storing token in query params
- No token in URL fragments
- No role inference from JWT payload
- No expiration validation via client clock

Token expiration handled by backend 401 only.

---

## Multi-App Behavior

MMC:

- Platform admin tokens
- No workspace context

Backoffice:

- Workspace-scoped tokens
- Must integrate WorkspaceGuard

Frontoffice:

- Student tokens
- Attempt engine protected via backend only

Auth module must be app-agnostic.

---

## Testability Requirements

Must support:

- Refresh race condition testing
- Expired token simulation
- Failed refresh scenario
- Logout during pending request
- Concurrent request retry logic

No global mutable state outside store.

---

## Explicit Non-Goals

This stage does NOT:

- Design login UI
- Implement registration
- Implement password reset UI
- Implement 2FA UI
- Implement RBAC enforcement
- Handle license validation

---

## Completion Criteria

Stage considered complete when:

- Auth store implemented
- Token manager implemented
- Refresh manager implemented
- Guards wired to router
- No token leaks in console
- Logout works
- Expired token auto-refresh works
- Failed refresh forces logout
- CI passes lint + TS
- All runtime auth tests pass

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
