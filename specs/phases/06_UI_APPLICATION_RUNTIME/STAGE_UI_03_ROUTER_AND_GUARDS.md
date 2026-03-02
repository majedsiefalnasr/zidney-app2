# STAGE_UI_03_ROUTER_AND_GUARDS

## Stage Type

UI Foundation — Router & Access Guard Architecture

---

## Stage Status

Status: DRAFT
Risk Level: MEDIUM
Last Updated: 2026-03-02T00:00:00.000Z

Scope Planned:

- 15 new files (5 per app: core/router/index.ts, 4 guard files)
- 14 file modifications (RouteMeta migration, main.ts guard registration)
- 4 file deletions (old guard files, singleton exports)
- registerGuards() barrel pattern per app
- Backoffice STAGE_17 inline license guard removal
- contextStore.loadContext() relocation to main.ts bootstrap

Deferred Scope:

- FeatureFlagGuard full implementation (stub only)
- Business page implementations

Constitutional Compliance:

- Technical plan compliant — task generation authorized

Notes:
Technical plan complete. Architecture Guardian: PASS. Task breakdown in progress.

---

## Purpose

Define the canonical routing system and guard pipeline shared across:

- MMC (Platform Admin)
- Backoffice (Tenant Admin)
- Frontoffice (Student Runtime)

This stage establishes:

- Router initialization contract
- Route meta schema
- Guard execution order
- Auth protection model
- Role-based route gating (UI-level only)
- Workspace resolution strategy (Backoffice)
- Navigation error handling

No business rules are enforced here — only access orchestration.

---

## Constitutional Constraints

Router layer must:

- Never enforce license limits
- Never enforce subscription validity
- Never validate permissions from JWT payload
- Never infer backend state from route params
- Never access database
- Never duplicate backend RBAC logic

Router guards only determine:

- Is user authenticated?
- Is route publicly accessible?
- Does UI require a role hint? (UI-only gating, backend authoritative)

Backend remains the final authority.

---

## Router Architecture

### Single Router Per App

Each app must define:

```
core/router/index.ts
```

Using Vue Router 4 (history mode).

No multiple router instances allowed.

---

### Deterministic Route Structure

Routes must be modular:

```
modules/<feature>/routes.ts
```

Each module exports its route definitions.

Router index aggregates:

```
createRouter({
  history,
  routes: [
    ...authRoutes,
    ...dashboardRoutes,
    ...productRoutes,
  ]
})
```

No inline route definitions inside components.

---

## Route Meta Contract

All protected routes must define meta:

```
meta: {
  requiresAuth: boolean
  roles?: string[]
  requiresWorkspace?: boolean
  public?: boolean
}
```

Rules:

- requiresAuth = true → AuthGuard must run
- roles defined → RoleGuard must run
- requiresWorkspace (Backoffice only)
- public routes must explicitly set public: true

No implicit assumptions.

---

## Guard Execution Pipeline

Guards must execute in this exact order:

1️⃣ AuthGuard  
2️⃣ WorkspaceGuard (Backoffice only)  
3️⃣ RoleGuard  
4️⃣ FeatureFlagGuard (future)

Order must not change.

Guards must live in:

```
core/guards/
```

---

## AuthGuard

Responsibilities:

- If route.meta.requiresAuth and user not authenticated → redirect to login
- If user authenticated and navigating to login → redirect to dashboard
- Must NOT decode JWT for role inspection
- Must rely on AuthStore only

No permission inference.

---

## WorkspaceGuard (Backoffice Only)

Backoffice requires workspace context.

Responsibilities:

- Validate workspace context resolved (subdomain or path)
- If missing → redirect to workspace selector
- Must not validate license
- Must not validate subscription
- Must not fetch data

Workspace resolution must be read-only at router level.

---

## RoleGuard (UI-Level Hint Only)

RoleGuard is UI convenience only.

Rules:

- If route.meta.roles defined:
  - Check if user.role exists in allowed list
  - If not → redirect to unauthorized page

Important:

- This is NOT security enforcement
- Backend still validates roles
- Guard only prevents UI navigation

---

## Navigation Failure Handling

Router must handle:

- 404 route → NotFoundView
- Unauthorized route → UnauthorizedView
- Unexpected errors → GlobalErrorView

No blank pages allowed.

---

## Multi-App Variations

MMC:

- No workspace guard
- Platform-level routes only

Backoffice:

- Requires WorkspaceGuard
- Routes prefixed by workspace context if applicable

Frontoffice:

- Student auth only
- Attempt routes protected via AuthGuard only

Router configuration must remain app-specific but follow same blueprint.

---

## Redirect Strategy

Login Redirect Logic:

- Save intended route before redirect to login
- After successful login → redirect back

Logout Redirect Logic:

- Always redirect to login route
- Clear any saved redirect

No infinite redirect loops allowed.

---

## Testability Requirements

Must support:

- Guard unit testing
- Authenticated route simulation
- Unauthorized role simulation
- Workspace missing simulation
- Redirect assertion tests
- 404 fallback tests

Router must be instantiable in test environment.

---

## Explicit Non-Goals

This stage does NOT:

- Define business pages
- Implement dashboard UI
- Implement product views
- Implement affiliate UI
- Enforce license state
- Handle subscription enforcement

Only routing & access orchestration.

---

## Completion Criteria

Stage considered complete when:

- Router initialized in all 3 apps
- Route meta contract standardized
- Guard pipeline implemented
- WorkspaceGuard implemented (Backoffice)
- 404 and Unauthorized views defined
- Redirect logic tested
- No inline route definitions in components
- CI passes lint + TypeScript
- No TODO placeholders in router layer

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
