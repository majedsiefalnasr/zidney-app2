# STAGE_UI_01_MMC_SHELL_INTEGRATION

## Stage Type

Platform MMC — UI Feature Stage (Shell Integration)

Depends On:

- Phase 06 UI Application Runtime (All stages)
- STAGE_16_SHARED_UI_SYSTEM (Backend/UI primitives alignment)

---

## Stage Status

Status: DRAFT

---

## Purpose

Integrate the MMC application with the Phase 06 runtime foundation and activate:

- Auth-aware layout shell
- MMC navigation structure
- Route grouping for platform modules
- Workspace-agnostic header behavior
- Global feedback integration

This stage wires MMC into the standardized runtime architecture. It does NOT implement feature pages
(Products, Licenses, Affiliates, etc.).

---

## Scope of This Stage

This stage MUST:

- Boot apps/mmc using Phase 06 structure
- Mount AppLayout as authenticated shell
- Register MMC route groups
- Inject MMC navigation config
- Bind auth.store to header UI
- Ensure logout flow works
- Validate 401 redirect handling
- Confirm notification system integration

This stage must NOT:

- Implement business pages
- Implement data tables
- Implement forms
- Implement feature stores
- Implement product logic

Only shell-level integration.

---

## MMC-Specific Layout Behavior

MMC differs from Backoffice & Frontoffice:

- No workspace_slug in URL
- Platform-level admin only
- No tenant resolver in shell
- No workspace switcher in header

Header must display:

- Logged-in user name
- Role badge (read-only display)
- Logout button

Sidebar must contain placeholders for:

- Dashboard
- Products
- Licenses
- License Lifecycle
- Provisioning
- Affiliates
- Members

Navigation config must live in:

```
core/navigation/mmc.navigation.ts
```

---

## Auth Integration

Requirements:

- Router guard blocks unauthenticated access
- Login route renders outside AppLayout
- Authenticated routes render inside AppLayout
- On 401 → redirect to login
- On logout → clear state + redirect

No role-based hiding in this stage. Only basic authenticated shell protection.

---

## Routing Structure

Routes must follow:

```
/login
/dashboard
/products
/licenses
/affiliates
/members
```

Each route renders placeholder view for now.

Route names must be defined and exported.

Router location:

```
core/router/mmc.routes.ts
```

---

## Sidebar Behavior

Sidebar must:

- Highlight active route
- Collapse responsively
- Use UI system primitives
- Read items from navigation config
- Not hardcode links in template

No business logic inside sidebar.

---

## Validation Checklist

MMC app must:

- Boot without errors
- Display login screen
- Authenticate (mock if backend unavailable)
- Render layout shell after login
- Navigate between routes
- Show header + sidebar
- Trigger logout successfully
- Handle manual token removal
- Display notification on session expiry

---

## Edge Cases to Validate

- Direct access to /dashboard without token
- Access token cleared during session
- Multiple rapid route changes
- Resize from desktop to mobile
- Hard refresh on authenticated route

Shell must remain stable.

---

## Explicit Non-Goals

This stage does NOT:

- Fetch products
- Fetch licenses
- Fetch affiliates
- Render dashboard widgets
- Implement RBAC visibility
- Implement feature UI logic

Only shell integration.

---

## Completion Criteria

Stage complete when:

- apps/mmc boots
- Login route functional
- Auth guard working
- AppLayout renders properly
- Sidebar navigation working
- Header displays user
- Logout clears state
- Notification layer functional
- No TypeScript errors
- No ESLint errors
- Manual smoke test passed

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
