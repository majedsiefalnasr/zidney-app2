# Feature Specification: UI State Management Architecture

**Feature Branch**: `ui-06-state-management`
**Created**: 2026-03-03
**Status**: Draft
**Phase**: 06_UI_APPLICATION_RUNTIME
**Stage File**: `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_06_STATE_MANAGEMENT.md`
**Input**: User description: "Define a standardized Pinia-based state management architecture for all Zidney frontend applications: MMC, Backoffice, and Frontoffice"

---

## User Scenarios & Testing

### User Story 1 — Developer Creates a Core Runtime Store (Priority: P1)

A frontend developer needs to add a globally available store (auth, app layout, notifications) to one of the three apps. They follow the standardized directory layout, extend the defined base pattern, and register the store during app initialization. The store is immediately available across all components via `useStore()` composition.

**Why this priority**: The core runtime stores (auth, app, ui, notification) are prerequisite infrastructure. All feature stores and components depend on them. Nothing else can be built safely until the runtime store contract is established.

**Independent Test**: Can be fully tested by instantiating a core store in isolation using `setActivePinia(createPinia())`, calling actions, and asserting reactive state updates—with no DOM or router dependency.

**Acceptance Scenarios**:

1. **Given** a developer creates a new core store in `src/core/state/`, **When** they follow the naming convention `[name].store.ts` and register it in `main.ts`, **Then** the store is accessible via `use[Name]Store()` in any component without additional configuration.
2. **Given** a core store is imported during tests, **When** `setActivePinia(createPinia())` is called in `beforeEach`, **Then** store state is isolated per test with no bleed-through between cases.
3. **Given** a core store action throws an `AppError`, **When** the error is caught inside the action, **Then** the store updates its `error` reactive property and does not swallow the error silently.
4. **Given** a component mounts and the auth store is already initialized, **When** the component reads `authStore.isAuthenticated`, **Then** it receives the current reactive value without triggering any side effects.

---

### User Story 2 — Component Reads and Triggers Store Actions (Priority: P1)

A Vue component needs to display user information and trigger a data-fetch. The developer calls `useAuthStore()` in the component's `<script setup>` block, reads reactive computed state, and dispatches an async action. The component never touches HTTP directly.

**Why this priority**: The "Component → Store → API Module → client" chain must be established as the only legal path for data access. Any violation creates untestable, fragile component code and risks security regressions.

**Independent Test**: Can be tested by mounting the component with a mocked store (or using `setActivePinia` with mocked API module), verifying that no `fetch` or API-client import appears in the component file.

**Acceptance Scenarios**:

1. **Given** a component needs user data, **When** it calls `const { user } = storeToRefs(useAuthStore())`, **Then** it receives a reactive reference that updates automatically when the store state changes.
2. **Given** a component needs to trigger a data load, **When** it calls `await authStore.loadCurrentUser()`, **Then** the store internally calls the API module, updates state, and the component reacts to the change.
3. **Given** a linter rule is active for the project, **When** a developer attempts to import the API client directly in a `.vue` file, **Then** the linter flags the import as a violation.
4. **Given** a store action is in a pending (loading) state, **When** a component reads `authStore.isLoading`, **Then** it receives `true` and can conditionally render a loading indicator.

---

### User Story 3 — Developer Reads from Another Store Without Direct Mutation (Priority: P2)

A feature store needs to read the current workspace slug from the workspace store. The developer imports `useWorkspaceStore()` inside the feature store's action, reads the slug as a reactive reference, and uses it to scope the API call. The developer never sets `useWorkspaceStore().someState = value` directly.

**Why this priority**: Cross-store mutation is a leading cause of state bugs and untestable store combinations. Enforcing read-only cross-store access is essential for deterministic state behavior.

**Independent Test**: Can be tested by composing two isolated stores in a test, asserting that one store's action successfully reads the other store's state via `storeToRefs`, and confirming no direct assignments occur across store boundaries.

**Acceptance Scenarios**:

1. **Given** a feature store action needs workspace context, **When** it calls `const { slug } = storeToRefs(useWorkspaceStore())`, **Then** it receives the current slug without modifying workspace store state.
2. **Given** a developer attempts to write `useWorkspaceStore().currentUser = value` from inside another store, **When** the linter or type-checker runs, **Then** it surfaces a violation.
3. **Given** a feature store needs to trigger behavior in another store, **When** it calls a public action on that store (e.g., `notificationStore.push(...)`) only, **Then** state flows through the owning store's own mutation path.
4. **Given** two stores are instantiated in a test, **When** one store calls a read-only property of the other, **Then** no shared mutable reference is present—each store's state is independently resettable.

---

### User Story 4 — Permitted UI Preferences Are Persisted Across Sessions (Priority: P2)

A user collapses the sidebar in Backoffice. The next time they open the application, the sidebar remains collapsed. Behind the scenes, the app store persists this preference using `pinia-plugin-persistedstate`, scoped to allowed keys only.

**Why this priority**: Session-persistent UI preferences are a genuine usability need. The risk is the developer persisting sensitive state (tokens, permissions) alongside UI prefs — this story ensures only safe keys are whitelisted.

**Independent Test**: Can be tested by updating the `sidebarCollapsed` state, checking that `localStorage` or the configured storage contains the expected serialized value, then reloading the store and confirming the value is hydrated.

**Acceptance Scenarios**:

1. **Given** a user sets sidebar collapsed, **When** they reload the app, **Then** the sidebar preference is restored from persistent storage.
2. **Given** the `appStore` is configured with `pinia-plugin-persistedstate`, **When** the persistence configuration is inspected, **Then** only explicitly whitelisted keys (e.g., `sidebarCollapsed`, `theme`) are included — no tokens, no permissions, no license state.
3. **Given** the auth store is active, **When** any persistence configuration is inspected for the auth store, **Then** no auth-related state is persisted to any storage mechanism.
4. **Given** `localStorage` is unavailable (private browsing, security policy), **When** the app initializes, **Then** it falls back gracefully without throwing and operates purely from in-memory state.

---

### User Story 5 — Store Fails Gracefully with Structured Loading & Error State (Priority: P2)

A developer fetches workspace data in Backoffice. The API call fails with a 503. The store catches the `AppError`, sets `isLoading = false`, populates `error` with a structured value, and the component renders a user-friendly error state. The error is never silently discarded.

**Why this priority**: Silent error swallowing creates invisible failures. Standardized loading/error state conventions allow any component to reliably surface or suppress errors using a consistent reactive API.

**Independent Test**: Can be tested by mocking the API module to reject with an `AppError`, calling the store action, and asserting that `isLoading === false` and `error` contains the structured error object afterward.

**Acceptance Scenarios**:

1. **Given** an async store action starts, **When** the action begins, **Then** `isLoading` transitions to `true` immediately.
2. **Given** an async store action completes successfully, **When** the action resolves, **Then** `isLoading` transitions back to `false` and `error` is `null`.
3. **Given** an async store action fails with an `AppError`, **When** the error is caught, **Then** `isLoading` is set to `false`, `error` is populated with the structured error, and the error is not re-thrown to the component.
4. **Given** a component reads `store.error`, **When** the store is in an error state, **Then** the component can read `error.code` and `error.message` to render contextual feedback.
5. **Given** a subsequent successful action runs after a previous error, **When** the action starts, **Then** `error` is reset to `null` before the async work begins.

---

### Edge Cases

- What happens when the user's session expires mid-action inside a store? The action must catch the resulting 401 error from the API client, store the error, and the auth store must trigger an unauthenticated state transition — not a crash.
- What happens when a store is used before Pinia is initialized? All stores must be consumed after `createPinia()` is registered in `main.ts`. Stores must not instantiate themselves at module load time via side effects.
- What happens when two concurrent actions in the same store both attempt to set `isLoading`? Each action must manage its own local `isLoading` flag or use scoped pending state; a single global `isLoading` flag per store is insufficient for concurrent multi-action stores.

  [NEEDS CLARIFICATION: Should stores with multiple concurrent async operations use a single boolean `isLoading` flag, or a per-action pending map (e.g., `pending: Record<string, boolean>`)? The answer determines the standard loading state shape across all stores.]

- What happens when `pinia-plugin-persistedstate` is not yet initialized before the first store access? Plugin must be registered before `app.mount()` in `main.ts`.
- What happens when JWT is stored and the app updates? JWT must never be in `localStorage`. Any inadvertent prior `localStorage` reads for JWT-like keys must be treated as a security violation.

---

## Requirements

### Functional Requirements

**Store Architecture**

- **FR-001**: Each Zidney app (MMC, Backoffice, Frontoffice) MUST initialize Pinia in its `main.ts` file using `createPinia()` before any store is accessed.
- **FR-002**: All stores MUST be authored using the Pinia Composition API `defineStore` with the setup syntax (not the options API syntax).
- **FR-003**: All stores MUST be TypeScript files with full type annotations on state members, action parameters, and action return types.
- **FR-004**: Core runtime stores MUST be located at `src/core/state/<name>.store.ts` in each application.
- **FR-005**: Feature-level stores MUST be located at `src/modules/<feature>/<feature>.store.ts` in each application.
- **FR-006**: Each store filename MUST follow the pattern `<name>.store.ts`.
- **FR-007**: Each store MUST export a single composable named `use<Name>Store` (PascalCase derived from the store's `id`).

**API Interaction**

- **FR-008**: Components MUST NOT import or call the API client directly. All API access MUST flow through store actions.
- **FR-009**: Store actions MUST call the feature's API module function, NOT the raw API client directly wherever a feature API module exists.
- **FR-010**: Store actions MUST catch `AppError` from failed API calls and update reactive error state; they MUST NOT allow unhandled promise rejections.
- **FR-011**: Store actions MUST NOT perform business logic calculations (price computation, grading, license limit arithmetic) — they orchestrate UI state only.

**Cross-Store Communication**

- **FR-012**: Stores MUST NOT directly mutate another store's state (e.g., `useOtherStore().someState = value` is forbidden).
- **FR-013**: Stores MAY read another store's reactive state using `storeToRefs(useOtherStore())` in read-only fashion.
- **FR-014**: Stores MAY call public actions on another store to trigger state changes in that store.
- **FR-015**: Circular store dependencies MUST NOT exist. Store dependency graph must be acyclic.

**Loading and Error State**

- **FR-016**: Every store that performs async operations MUST expose an `isLoading` reactive boolean that is `true` during the async operation and `false` otherwise.
- **FR-017**: Every store that performs async operations MUST expose an `error` reactive property typed as `AppError | null`, defaulting to `null`.
- **FR-018**: Before each new async action begins, `error` MUST be reset to `null`.
- **FR-019**: On action failure, `isLoading` MUST be set to `false` and `error` MUST be set to the caught `AppError`.

**State Persistence**

- **FR-020**: Default store state MUST be in-memory only. Persistence must be explicitly opted into.
- **FR-021**: Persistence MUST be implemented using `pinia-plugin-persistedstate` registered in the app's `main.ts`.
- **FR-022**: Persisted stores MUST declare an explicit `paths` or `pick` configuration to whitelist exactly which state keys are persisted.
- **FR-023**: The following MUST NEVER be persisted to any storage mechanism: access tokens, refresh tokens, JWT, user permissions, license state, attempt state, sensitive user PII.
- **FR-024**: Allowed persistence targets are UI preferences only: `sidebarCollapsed`, `theme`, `locale`, and any equivalent pure UI preference keys.
- **FR-025**: If persistent storage is unavailable, the store MUST fall back to in-memory operation without throwing.

**Security**

- **FR-026**: JWT and authentication tokens MUST NOT be stored in `localStorage` or `sessionStorage`. Tokens MUST reside in memory (store state) or a secure HTTP-only cookie managed by the server.
- **FR-027**: Store state MUST NOT expose raw token strings as publicly readable properties wherever possible; token access MUST be encapsulated behind actions.

**Testability**

- **FR-028**: Every store MUST be unit-testable in isolation using `setActivePinia(createPinia())` without requiring a browser environment, DOM, or Vue component.
- **FR-029**: API module dependencies MUST be injectable/mockable so store actions can be tested against simulated success, error, and network failure scenarios.
- **FR-030**: Store state MUST be fully resettable between test cases using `store.$reset()` or by re-instantiating via `setActivePinia`.
- **FR-031**: Stores MUST export no module-level side effects. Initialization must happen only when the store composable is first called.

**Naming and Organization**

- **FR-032**: Store `id` strings MUST be unique across the application and follow the kebab-case pattern `<app>-<domain>` (e.g., `backoffice-auth`, `mmc-app`, `frontoffice-attempt-ui`).
- **FR-033**: Store files placed in `core/state/` MUST NOT import from `modules/`. Core stores are not allowed to depend on feature stores.
- **FR-034**: Each app MUST register all required Pinia plugins (persistence, devtools) in a single `createPinia()` chain in `main.ts`, not scattered across feature files.

**Scope Boundaries Per App**

- **FR-035**: MMC stores MUST scope state to platform-level concerns only (global admin, platform config). They MUST NOT contain workspace-scoped data.
- **FR-036**: Backoffice stores MUST scope feature state to workspace context. Workspace slug MUST be read from the runtime workspace store, not hardcoded.
- **FR-037**: Frontoffice stores related to attempt UI MUST NOT cache grading results permanently. Grading data is transient per session.

### Key Entities

- **Core Store**: A runtime-level store (`core/state/`) that manages cross-feature concerns such as auth session, global layout state, or notifications. One instance per app.
- **Feature Store**: A domain-scoped store (`modules/<feature>/<feature>.store.ts`) that manages the UI state of a specific feature. Isolated to that feature's modules.
- **Auth Store** (`auth.store.ts`): Manages the authenticated user session — current user identity, token lifecycle (in-memory), authentication status, and logout action.
- **App Store** (`app.store.ts`): Manages global application layout state — sidebar collapsed, active view mode, any app-wide toggles.
- **UI Store** (`ui.store.ts`): Manages transient UI state — modals open/closed, drawers, overlay visibility.
- **Notification Store** (`notification.store.ts`): Manages toast and alert notifications — push, dismiss, and clear actions.
- **Workspace Store** (`workspace.store.ts`, Backoffice only): Manages the resolved workspace context (slug, name, tier) for the active session. Read by feature stores; not mutated by them.
- **AppError**: The structured error type imported from the shared packages. Used as the typed `error` state across all stores.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All stores in all three apps can be instantiated and tested in a Node.js-only environment (no browser, no DOM) within CI in under 3 seconds per store.
- **SC-002**: Zero component files in the codebase contain direct API client imports; all API access routes through store actions.
- **SC-003**: Zero stores persist access tokens, refresh tokens, JWT, or permission matrices to `localStorage` or `sessionStorage` as verified by automated test coverage.
- **SC-004**: All async store actions expose `isLoading` and `error` reactive properties; no async action exists without both flags.
- **SC-005**: Store state resets completely between test cases — no shared mutable state bleeds across tests; all tests pass in isolation and in parallel.
- **SC-006**: CI pipeline passes TypeScript strict mode and lint checks on all store files with zero errors.
- **SC-007**: No circular dependencies exist in the store dependency graph as verified by a dependency analysis tool.
- **SC-008**: All persistence configurations include an explicit `paths`/`pick` whitelist — no store persists state implicitly.
- **SC-009**: All core stores are registered and hydrated before the first route guard executes (within the same tick as `app.mount()`).
- **SC-010**: Store `id` values are unique across each app, verified by a lint or test rule.

---

## Assumptions

- The `api-client` package (`packages/api-client`) exports typed API module functions (e.g., `authApi.login(...)`) that stores will call. Stores do not compose raw HTTP calls.
- `AppError` is exported from `packages/types` or `packages/domain-core` and is the agreed error contract for all API failure cases.
- `pinia-plugin-persistedstate` is an approved dependency and is already listed in the monorepo's dependency policy.
- Each app (`mmc`, `backoffice`, `frontoffice`) has its own independent `main.ts` with its own `createPinia()` instance. No cross-app Pinia sharing occurs.
- The `ui-02-api-client-layer` stage is closed and the API client is stable. This stage depends on that contract.
- The `ui-09-security-and-token-handling` stage governs the JWT/token security model at a deeper level. This spec aligns with its output — JWT stays in memory or secure cookie.
- Vue DevTools integration for Pinia (development only) is considered a convenience, not a requirement for this stage.
- Store test utilities (`setActivePinia`, `createPinia` from `@pinia/testing`) are available in the test infrastructure.

---

## Out of Scope

This stage does NOT define:

- The products store implementation
- The licenses store implementation
- The affiliates store implementation
- The attempt engine store implementation
- The dashboard store implementation
- Business DTOs or API response shapes for feature domains
- The router guard integration (that belongs to `ui-03-router-and-guards`)
- Deep token refresh logic (belongs to `ui-02-api-client-layer`)
- The env configuration pattern (belongs to `ui-05-env-configuration`)
