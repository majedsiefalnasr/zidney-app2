# STAGE_UI_01_BACKOFFICE_SHELL

Phase: 03_BACKOFFICE_CORE  
Track: UI (apps/backoffice)  
Dependency: Phase 06 UI Runtime Architecture

---

## Stage Status

Status: DRAFT

---

## Purpose

This stage establishes the foundational UI shell for the Backoffice application.

It defines:

- Application layout
- Navigation structure
- Router integration
- Tenant-scoped authentication handling
- Permission-aware rendering
- Global loading & error boundaries

No feature-specific screens are implemented in this stage.

This stage provides the structural base required for all subsequent Backoffice UI stages.

---

## Application Context

Backoffice UI lives in:

apps/backoffice

Backoffice is:

- Tenant-scoped
- Uses tenant JWT (issued by API)
- Connected only to tenant database through API
- Never communicates with master_db
- Never uses MMC token

---

## Architectural Constraints

Backoffice UI must:

- Follow Phase 06 runtime architecture
- Use centralized API client layer
- Use router guards for auth + RBAC
- Not contain business logic
- Not perform direct DB assumptions
- Not share auth context with MMC

Violation of tenant boundary is forbidden.

---

## Layout Structure

The shell must implement:

### 1️⃣ Main Layout

Structure:

- Sidebar (left navigation)
- Topbar (user info + workspace info)
- Content area (router view)
- Global notification container
- Global error boundary

No feature logic inside layout.

---

### 2️⃣ Sidebar Navigation (Tenant-Aware)

Navigation must be grouped:

- Academic Structure
- Content & Exams
- Users
- Commercial
- Media
- Communication
- Dashboard

Visibility must be permission-driven.

Sidebar must not render links user lacks permission for.

---

### 3️⃣ Topbar

Must include:

- Workspace name (from tenant context)
- Logged-in user name
- Role indicator
- Logout action
- Notification icon (future-ready)

No token exposure.

---

## Router Configuration

Router must:

- Be defined in apps/backoffice
- Use createRouter + history mode
- Support lazy-loaded routes
- Support route-level RBAC meta fields

Each route must define:

meta: { requiresAuth: true, permissions: ['exam:create', 'student:view'] // example }

---

## Router Guards

Global Guard must:

1. Validate tenant JWT presence
2. Validate token expiration
3. Redirect to login if invalid
4. Validate permission if meta.permissions defined
5. Handle 403 gracefully

No UI route must be accessible without auth.

---

## Authentication Integration

Backoffice auth must:

- Use tenant JWT
- Store token in secure storage (localStorage or cookie depending on policy)
- Auto-refresh if refresh endpoint exists
- Handle 401 globally
- Redirect to login on invalid session

Backoffice must never:

- Accept MMC token
- Share auth state with MMC app
- Reuse master token

---

## State Management

State store must manage:

- Auth state
- Current user
- Current workspace
- Permission set
- Global loading state

State must:

- Reset on logout
- Refresh after role change
- Not persist sensitive PII unnecessarily

Pinia recommended.

---

## API Client Binding

Shell must:

- Inject tenant JWT into Authorization header
- Attach workspace_slug header if required
- Use centralized axios/fetch wrapper
- Map 401 → redirect
- Map 403 → forbidden page
- Map 500 → global error page

No inline fetch calls allowed in layout components.

---

## Global Error Handling

Shell must implement:

- Global error boundary
- Dedicated Forbidden page
- Dedicated NotFound page
- Dedicated ServerError page

Raw backend error messages must not be shown.

---

## Multi-Tenant Awareness

Shell must:

- Derive workspace_slug from subdomain or path (depending on runtime design)
- Display workspace context clearly
- Prevent navigation if workspace context invalid

If tenant not found:

- Show Workspace Not Found page
- Do not crash

---

## Security Requirements

Shell must enforce:

- No token printed in console
- No token stored in reactive debug state
- No sensitive headers exposed
- XSS-safe rendering
- Strict CSP compatible structure

---

## Performance Requirements

Shell must:

- Lazy-load feature routes
- Avoid large initial bundle
- Avoid blocking synchronous initialization
- Keep first meaningful paint fast

---

## Validation Gate

This stage is complete when:

- User can log in (tenant JWT)
- Protected routes block unauthorized access
- Permission-based sidebar rendering works
- Logout clears state completely
- Workspace context displayed correctly
- No console errors on boot
- No direct API logic in layout

---

## Failure Policy

If:

- Cross-tenant access detected
- MMC token accepted
- Routes accessible without auth
- Permissions ignored in UI

Then:

Stage must be refactored before any feature UI begins.

---

## Completion Criteria

- apps/backoffice boots successfully
- Router configured
- Auth guard functional
- Layout renders
- State management wired
- Global error handling active
- Ready for feature UI stages

---

## Governance Rule

No Backoffice feature UI stage may begin until this shell stage is complete.

This stage is:

Backoffice UI Foundation.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
