# STAGE_UI_06_STATE_MANAGEMENT

## Stage Type

UI Foundation — Centralized State Management Architecture

---

## Stage Status

Status: DRAFT
Risk Level: LOW
Last Updated: 2026-03-03T00:00:00.000Z

Scope Defined:

- Pinia 2.x Composition API store architecture for MMC, Backoffice, Frontoffice (37 FRs)
- Domain-oriented store boundaries (core/state vs modules/<feature>)
- API interaction chain: Component -> Store -> API Module -> client (no direct HTTP in components)
- Cross-store communication rules (read via storeToRefs, no direct mutation)
- Loading state: isLoading: boolean (primary) + pending: Record<string, boolean> (multi-action)
- Error state: error: AppError | null with auto-reset and explicit clearError() action
- State persistence via pinia-plugin-persistedstate with explicit paths whitelist
- Security: JWT never in localStorage/sessionStorage (memory or secure HTTP-only cookie)
- Testability: setActivePinia isolation, $reset() required on ALL stores
- Notification store: queue-based, independently dismissible
- CSR-only (no SSR scope)

Deferred Scope:

- Feature-specific store implementations (products, licenses, attempt engine, dashboard)
- Router guard integration (ui-03-router-and-guards)
- Deep token refresh logic (ui-02-api-client-layer)
- SSR support

Constitutional Compliance:

- Clarifications resolved - planning authorized

Notes:
All specification ambiguities resolved. 6/6 clarifications encoded. Ready for technical planning.

---

## Purpose

Define the standardized state management strategy for all Zidney frontend applications:

- MMC
- Backoffice
- Frontoffice

This stage establishes:

- Pinia-based store architecture
- Domain-oriented store boundaries
- Cross-store communication rules
- API interaction patterns inside stores
- State persistence policy
- Testing and isolation rules

This stage does NOT implement business feature stores.
It defines the runtime contract they must follow.

---

## Constitutional Constraints

State layer must:

- Never contain backend business logic
- Never enforce license limits
- Never compute grading logic
- Never duplicate RBAC enforcement
- Never call HTTP directly from components
- Never mutate another store directly

Stores orchestrate UI state only.
Backend remains authoritative for business rules.

---

## State Architecture Overview

Pinia is mandatory.

Each app must initialize Pinia in:

```
main.ts
```

All stores must live under:

```
core/state/         (runtime-level stores)
modules/<feature>/  (feature-level stores)
```

No global mutable singletons allowed.

---

## Store Classification

### Core Stores (Runtime-Level)

Located in:

```
core/state/
```

Examples:

- auth.store.ts
- app.store.ts
- ui.store.ts
- notification.store.ts

Core stores handle:

- Auth session
- Global loading states
- Layout toggles
- Global notifications

They must NOT contain business data like products or licenses.

---

### Feature Stores (Domain-Oriented)

Located in:

```
modules/<feature>/store.ts
```

Examples:

- modules/products/products.store.ts
- modules/licenses/licenses.store.ts
- modules/affiliates/affiliates.store.ts

Rules:

- One primary store per feature domain
- Stores encapsulate feature UI state
- Stores may call feature API module
- Stores may transform API DTO to UI model
- Stores must not perform complex business calculations

---

## API Interaction Pattern

Strict pattern:

Component → Store → API Module → core/api/client

Never:

Component → API directly

Store must:

- Expose actions (async)
- Catch AppError
- Update reactive state
- Never swallow errors silently

---

## Cross-Store Communication

Forbidden:

```
storeA.someState = storeB.someState
```

Allowed:

- Import store via useOtherStore()
- Call public action
- Use events (if needed)
- Read reactive state (readonly)

No circular dependencies allowed.

---

## State Persistence Policy

Default:

- No persistence
- In-memory only

Allowed persistence (explicit only):

- UI preferences (e.g., theme)
- Sidebar collapsed state

Forbidden persistence:

- Access tokens
- Sensitive user data
- License state
- Permission matrices

Persistence must use:

```
pinia-plugin-persistedstate
```

Only if formally approved.

---

## Multi-App Considerations

MMC:

- Platform-level stores
- No workspace-scoped data inside core stores

Backoffice:

- Workspace-aware feature stores
- Workspace context read from runtime layer

Frontoffice:

- Attempt-related UI state
- Must not cache grading results permanently

Store architecture must remain identical across apps.

---

## Testability Requirements

Stores must support:

- Unit testing without DOM
- Mocked API modules
- Simulated error responses
- State reset between tests
- No reliance on global window

Each store must export pure factory function:

```
defineStore(...)
```

No side effects on import.

---

## Explicit Non-Goals

This stage does NOT:

- Implement products store
- Implement licenses store
- Implement affiliates store
- Implement attempt store
- Implement dashboard store
- Define business DTOs

Only architecture & rules.

---

## Completion Criteria

Stage considered complete when:

- Pinia initialized in all apps
- Core runtime stores scaffolded
- Store folder structure standardized
- No API calls in components
- No cross-store mutation
- Persistence policy documented and enforced
- Unit tests can instantiate stores independently
- CI passes lint + TypeScript
- No TODO placeholders in state layer

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
