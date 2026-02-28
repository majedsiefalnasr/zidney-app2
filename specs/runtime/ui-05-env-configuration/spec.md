# Feature Specification: ENV Configuration

**Feature Branch**: `ui-05-env-configuration`  
**Created**: 2026-02-28  
**Status**: Draft  
**Phase**: 06_UI_APPLICATION_RUNTIME  
**Stage File**: `specs/phases/06_UI_APPLICATION_RUNTIME/STAGE_UI_05_ENV_CONFIGURATION.md`  
**Input**: Standardized environment configuration strategy for all Zidney frontend applications (MMC, Backoffice, Frontoffice)

---

## User Scenarios & Testing

### User Story 1 — Centralized Environment Access (Priority: P1)

As a developer working on any Zidney frontend application (MMC, Backoffice, or Frontoffice), I need a single, centralized module to access all environment configuration so that I never use raw `import.meta.env` or `process.env` calls scattered across the codebase.

**Why this priority**: This is the foundational contract — every other story depends on a single entry point for environment access. Without it, configuration sprawl creates maintenance burden and security risk.

**Independent Test**: Import the centralized config module in any component or service; confirm it returns typed, validated values and that no other file in the codebase directly references `import.meta.env`.

**Acceptance Scenarios**:

1. **Given** a developer imports the environment module, **When** they access a configuration value, **Then** they receive a typed, non-undefined value with no direct reference to `import.meta.env`.
2. **Given** a codebase lint rule is active, **When** any file outside the centralized config module references `import.meta.env` directly, **Then** the lint check fails with a clear violation message.
3. **Given** a new environment variable is needed, **When** a developer adds it, **Then** they add it only to the centralized config module and the corresponding `.env` file — nowhere else.

---

### User Story 2 — API Base URL Resolution (Priority: P1)

As a frontend application, I need to resolve the correct API base URL for my context so that all HTTP requests target the appropriate backend endpoint without hardcoding URLs.

**Why this priority**: Every frontend application must communicate with the API. Incorrect or inconsistent base URL resolution breaks all API interactions.

**Independent Test**: In each app (MMC, Backoffice, Frontoffice), call the API base resolution helper and verify it returns the correct URL for the current environment without any hardcoded values.

**Acceptance Scenarios**:

1. **Given** the MMC application is running, **When** the API base URL is requested, **Then** it returns the value from the `VITE_API_BASE_URL` environment variable.
2. **Given** the Backoffice application is running in a workspace context, **When** the API base URL is requested, **Then** it returns a URL resolved from the environment variable, relying on the backend for workspace context — never computing workspace identifiers in the frontend.
3. **Given** the Frontoffice application is running, **When** the API base URL is requested, **Then** it returns the runtime API base from the environment variable.
4. **Given** the `VITE_API_BASE_URL` variable is missing or empty, **When** the application initializes, **Then** the configuration module surfaces a clear, developer-visible error during startup rather than silently failing at runtime.

---

### User Story 3 — Environment Mode Helpers (Priority: P2)

As a developer, I need helper functions to determine the current environment mode (development, staging, production) so that I can conditionally enable debug tooling or adjust non-security display behavior without scattering string comparisons throughout the codebase.

**Why this priority**: Mode detection prevents scattered string comparisons and supports consistent conditional behavior across all apps.

**Independent Test**: Set the environment mode to each supported value and verify the corresponding helper returns `true` while all others return `false`.

**Acceptance Scenarios**:

1. **Given** the application is running in development mode, **When** `isDev()` is called, **Then** it returns `true`, and `isProd()` and `isStaging()` return `false`.
2. **Given** the application is running in production mode, **When** `isProd()` is called, **Then** it returns `true`, and `isDev()` and `isStaging()` return `false`.
3. **Given** the application is running in staging mode, **When** `isStaging()` is called, **Then** it returns `true`, and `isDev()` and `isProd()` return `false`.
4. **Given** an unrecognized mode value is set, **When** any mode helper is called, **Then** all return `false` and no error is thrown.

---

### User Story 4 — Feature Flag Injection (Priority: P2)

As a developer, I need a read-only feature flag system sourced from environment variables so that I can toggle UI experiments and display behavior without redeploying and without bypassing backend enforcement.

**Why this priority**: Feature flags enable controlled rollout of UI-only experiments. They must be read-only and limited to non-security display behavior.

**Independent Test**: Set a feature flag environment variable, then read it through the feature flags module and confirm it's correctly exposed as a boolean. Verify the flag value cannot be modified at runtime.

**Acceptance Scenarios**:

1. **Given** a `VITE_ENABLE_DEBUG` environment variable is set to `"true"`, **When** the corresponding feature flag is read, **Then** it returns `true` as a boolean.
2. **Given** a feature flag environment variable is not set, **When** the corresponding flag is read, **Then** it returns a defined default value (e.g., `false`) — never `undefined`.
3. **Given** a feature flag value is read at runtime, **When** any code attempts to modify it, **Then** the modification is prevented (the flag object is immutable / frozen).
4. **Given** feature flags are loaded, **When** they are used in any component, **Then** they only control UI display behavior and never gate security, permissions, or business logic.

---

### User Story 5 — Secure Exposure Policy (Priority: P1)

As a platform operator, I need assurance that no secrets, database credentials, or private API keys are exposed to the browser runtime so that the platform remains secure.

**Why this priority**: Security is non-negotiable. Secret leakage to the frontend is a platform failure.

**Independent Test**: Audit the configuration module's output in the browser; confirm that only `VITE_`-prefixed, non-sensitive values are present. Confirm no secrets appear in compiled bundles or window objects.

**Acceptance Scenarios**:

1. **Given** a non-`VITE_`-prefixed environment variable exists in the server environment, **When** the frontend application loads, **Then** that variable is not accessible in the browser.
2. **Given** the application is running in production mode, **When** configuration values are loaded, **Then** no configuration values are logged to the console.
3. **Given** the configuration module is initialized, **When** inspecting the browser's `window` object, **Then** no secret tokens, database credentials, or private API keys are present.
4. **Given** the built application bundle is inspected, **When** searching for sensitive patterns (connection strings, private keys), **Then** no matches are found.

---

### User Story 6 — Test Environment Support (Priority: P2)

As a developer writing unit or integration tests, I need to mock or override environment configuration without relying on the global `window` object so that tests remain isolated and deterministic.

**Why this priority**: Testability is a governance requirement. Environment mocking ensures tests don't depend on host machine state.

**Independent Test**: Write a unit test that provides mock environment values, calls the config module, and verifies the mocked values are returned — without setting any real environment variables.

**Acceptance Scenarios**:

1. **Given** a unit test provides mock environment values, **When** the config module is imported, **Then** it uses the mocked values instead of actual environment variables.
2. **Given** a test simulates staging mode, **When** `isStaging()` is called, **Then** it returns `true`.
3. **Given** a test overrides the API base URL, **When** `getApiBase()` is called, **Then** it returns the test-provided URL.
4. **Given** a test toggles a feature flag, **When** the flag is read, **Then** it reflects the test-provided value.

---

### User Story 7 — Multi-App Consistency (Priority: P3)

As a platform maintainer, I need all three frontend applications to follow the same environment configuration contract so that onboarding, debugging, and maintenance are consistent.

**Why this priority**: Consistency reduces cognitive load and prevents drift between apps. Lower priority because it's an outcome of implementing the same module pattern in each app.

**Independent Test**: Compare the public API surface of the env module in all three apps; confirm they export the same functions and follow the same naming convention.

**Acceptance Scenarios**:

1. **Given** the env module exists in MMC, Backoffice, and Frontoffice, **When** their exports are compared, **Then** they share the same function signatures for `getApiBase()`, `isDev()`, `isProd()`, `isStaging()`, and feature flag access.
2. **Given** a new environment variable is introduced, **When** it's added following the convention, **Then** the same naming pattern (`VITE_` prefix) and access pattern (via env.ts) applies across all apps.
3. **Given** app-specific configuration differences exist (e.g., Backoffice workspace context), **When** they are examined, **Then** they are handled via separate `.env` files and not via code branching inside the shared env module.

---

### Edge Cases

- What happens when a required environment variable is missing at build time? → The build should fail with a clear error message identifying the missing variable.
- What happens when `VITE_APP_ENV` is set to an unrecognized value? → Mode helpers all return `false`; the application does not crash.
- What happens when a feature flag variable has a non-boolean string value (e.g., `"yes"`, `"1"`)? → The flag module normalizes known truthy strings to `true` and all other values to `false`.
- What happens when multiple `.env` files conflict (e.g., `.env` vs `.env.production`)? → Vite's built-in precedence rules apply; the most specific file wins. The env module does not add custom merging logic.
- What happens when a developer accidentally exposes a secret by naming it with the `VITE_` prefix? → Naming conventions and code review processes catch this; the env module itself does not validate secret content, as it has no way to distinguish a secret from a non-secret value. Documentation must clearly warn against this.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a single centralized module (`core/config/env.ts`) as the only access point for environment variables in each frontend application.
- **FR-002**: System MUST prohibit direct usage of `import.meta.env` outside the centralized configuration module. A lint rule MUST enforce this.
- **FR-003**: System MUST expose a `getApiBase()` function that returns the resolved API base URL for the current application context.
- **FR-004**: System MUST expose environment mode helpers — `isDev()`, `isProd()`, `isStaging()` — that return boolean values based on the current environment.
- **FR-005**: System MUST provide a feature flags module (`core/config/feature-flags.ts`) that exposes read-only boolean flags sourced from `VITE_`-prefixed environment variables.
- **FR-006**: System MUST freeze or otherwise make immutable the feature flags object at runtime to prevent modification.
- **FR-007**: System MUST ensure that only `VITE_`-prefixed variables are accessible in the browser runtime (enforced by Vite's built-in convention).
- **FR-008**: System MUST NOT log configuration values to the console in production mode.
- **FR-009**: System MUST NOT expose secrets, database credentials, or private API keys to the browser via the window object, bundle, or any other mechanism.
- **FR-010**: System MUST throw a synchronous exception before `createApp().mount()` if a required environment variable (e.g., `VITE_API_BASE_URL`) is missing. The app must never render in an invalid configuration state.
- **FR-011**: System MUST support mock injection of environment values in unit tests via a factory function pattern — `createEnvConfig(overrides?)` — that accepts optional overrides. In production, this factory is called once with no overrides and the result is frozen. In tests, callers pass mock values to obtain a testable instance.
- **FR-012**: System MUST follow the same env module contract (function names, types, patterns) across MMC, Backoffice, and Frontoffice. Consistency is enforced via a shared TypeScript interface (documented contract). Each app implements the interface independently — no shared runtime package.
- **FR-013**: System MUST handle app-specific configuration differences (e.g., different API base URLs) via separate `.env` files, not via code branching inside the env module.
- **FR-014**: System MUST provide an app-level configuration module (`core/config/app-config.ts`) that aggregates environment values and feature flags into a single typed configuration object.
- **FR-015**: System MUST NOT allow runtime modification of any configuration value. Configuration is immutable after initialization. The `createEnvConfig()` factory returns a frozen object; subsequent mutation attempts are silently ignored (Object.freeze behavior).
- **FR-016**: System MUST NOT allow user input to be merged into configuration values.
- **FR-017**: System MUST NOT use feature flags to gate security, permission, or business logic. Feature flags are limited to UI display behavior and experiments.
- **FR-018**: System MUST NOT allow environment logic (env access, mode checks) inside application modules — only inside `core/config/`.

### Key Entities

- **Environment Variable**: A key-value pair set at build time via `.env` files, prefixed with `VITE_` for browser exposure. Attributes: name, value, required/optional.
- **App Config**: A typed, immutable object aggregating API base URL, environment mode, app name, and other non-sensitive settings. Frozen at initialization.
- **Feature Flag**: A named boolean toggle sourced from a `VITE_` environment variable. Read-only. Controls only UI display behavior.
- **Environment Mode**: One of `development`, `staging`, or `production`. Determined by `VITE_APP_ENV` (or equivalent). Exposes helper functions for conditional logic.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Zero instances of direct environment variable access (`import.meta.env`) exist outside the centralized configuration module across all three frontend applications.
- **SC-002**: All three applications (MMC, Backoffice, Frontoffice) use the same env module API surface — identical function names and return types.
- **SC-003**: No secrets, database credentials, or private API keys are present in any production frontend bundle or browser runtime.
- **SC-004**: Missing required environment variables cause a visible, developer-friendly error at application startup — not a silent runtime failure.
- **SC-005**: Unit tests can fully mock environment configuration without accessing `window`, `process.env`, or real `.env` files.
- **SC-006**: Feature flag values cannot be mutated after initialization — any attempt to modify them has no effect.
- **SC-007**: No configuration values are logged to the console in production mode.
- **SC-008**: All environment-related code resides exclusively within the `core/config/` directory in each application.

---

## Assumptions

- All three frontend applications use Vite as their build tool, which enforces the `VITE_` prefix convention for browser-exposed variables.
- The workspace context for Backoffice is resolved via the route (`/workspace/:slug/backoffice/...`) and backend-issued context — the env module does not compute workspace identifiers.
- Feature flags in this stage are static (set at build time). Runtime feature flag fetching from a backend service is out of scope.
- The env module pattern is implemented independently in each app (not as a shared package), since each app has its own Vite build pipeline. A shared TypeScript interface defines the contract; each app implements it independently.
- Configuration must be initialized synchronously before `createApp()` is called. `createEnvConfig()` (or equivalent) must execute at the top of `main.ts` before any Vue instance or service is created. No lazy initialization, no deferred loading.
- App-specific environment files (`.env`, `.env.development`, `.env.staging`, `.env.production`) follow Vite's standard file loading and precedence conventions.

---

## Explicit Non-Goals

- API client implementation (HTTP client, interceptors, retry logic)
- Authentication logic (login, JWT handling, session management)
- Router guards or navigation logic
- Workspace resolution logic (tenant slug extraction, DB selection)
- Business feature toggles controlled by backend (subscription-level features)
- Runtime feature flag fetching from an API endpoint
- Secret management infrastructure (vault, sealed secrets)
- App version injection or API version headers (belongs to API client stage)

---

## Clarifications

### Session 2026-02-28

- Q: How should FR-010 surface errors for missing required env vars — throw before mount, show fallback UI, or log-and-continue? → A: Throw a synchronous exception before `createApp().mount()`. The app must never render in an invalid state.
- Q: When must configuration be initialized — synchronously before mount, lazily on first access, or asynchronously? → A: Synchronously before app mount. `createEnvConfig()` must be called at the top of `main.ts` before `createApp()`. No lazy or deferred initialization.
- Q: Should app version (e.g., `VITE_APP_VERSION`) be exposed via the env module for use in API request headers? → A: Out of scope for this stage. Version headers belong to the API client stage.
- Q: How does FR-011 (test mock injection) coexist with FR-015 (immutability) — dependency injection, module mock, or factory function? → A: Factory function pattern. The env module exports `createEnvConfig(overrides?)` that accepts optional overrides for testing. In production, called once with no overrides and the result is frozen. In tests, callers pass mock values.
- Q: How is FR-012 (multi-app consistency) enforced — shared package, shared TypeScript interface, or code review only? → A: Shared TypeScript interface in a documented contract location. Each app implements the interface independently (no shared runtime package). Consistency enforced via TypeScript interface conformance and code review.
