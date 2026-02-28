# SPEC – Tenant Bootstrap (STAGE_17)

**Phase:** 03 – Backoffice Core  
**Domain:** 01 – Foundation  
**Stage:** STAGE_17_TENANT_BOOTSTRAP  
**Status:** Specification  
**Priority:** Critical  
**Feature Area:** Backoffice runtime initialization, license enforcement, RBAC skeleton, module-aware layout  
**Date:** 2026-02-28

---

## Feature Overview

### What Is Being Built

A deterministic, license-aware runtime foundation that governs every Backoffice request from the moment a staff user enters the system. This stage establishes:

- Authoritative runtime context injection (tenant identity, license state, enabled modules, limits, versions)
- License gate enforcement: only ACTIVE workspaces may access Backoffice
- Module visibility contract: server-side enforcement of which modules are accessible per license
- RBAC skeleton: minimal role/permission tables in the tenant DB with middleware enforcement
- Module-aware navigation layout (AppLayout → Sidebar / TopBar / ContentArea)
- Workspace-scoped JWT validation with role and permissions claims
- Limit awareness exposure (student and staff capacity, informational only at this stage)
- WebSocket lifecycle validation (workspace, license, token, request tracing)
- Structured observability on every request

No academic content, no examination logic, and no business workflows are introduced. This stage defines the runtime boundary only.

### Phase & Stage Mapping

- **Phase:** 03 – Backoffice Core
- **Domain:** 01 – Foundation
- **Stage File:** [STAGE_17_TENANT_BOOTSTRAP.md](../../../phases/03_BACKOFFICE_CORE/01_FOUNDATION/STAGE_17_TENANT_BOOTSTRAP.md)
- **Prerequisite Stages:**
  - STAGE_02 – Multi-Tenancy Architecture (tenant resolution, DB-per-tenant, connection pool)
  - STAGE_03 – Authentication System (workspace-scoped JWT, token_version, staff auth)
  - STAGE_04 – License Engine (license state transitions, limit records)
  - STAGE_05 – Tenant Provisioning Service (tenant DB bootstrap, schema versioning)
- **Provides foundation for:** All subsequent Backoffice academic and management modules

### Affected Architectural Layers

- **Isolation:** Core enforcement — all Backoffice DB access is scoped to the resolved tenant DB; never master_db
- **License Enforcement:** Mandatory — ACTIVE status required; enforcement occurs before any route resolves
- **Attempt Engine:** Not in scope for this stage
- **Worker:** Not in scope for this stage
- **Runtime:** Runtime context (modules, limits, versions) is injected by middleware; Backoffice consumes it, never recomputes it
- **Frontoffice:** Separate runtime; shares packages/ui-system but has a distinct layout boundary

---

## Constitutional Compliance Declaration

**Mandatory Compliance Confirmations:**

✓ **No cross-tenant access** — All DB operations use the tenant-scoped connection pool; workspace_id is validated on every authenticated request  
✓ **No middleware bypass** — Middleware order: Correlation ID → Tenant Resolver → License Enforcement → Schema Version → Authentication → Route Handler  
✓ **No grading outside worker** — This stage contains no grading logic  
✓ **No direct DB instantiation** — All queries execute within the tenant resolver context; no global DB singleton  
✓ **No snapshot integrity weakening** — Attempt engine not in scope  
✓ **No transaction boundary weakening** — RBAC table initialization is migration-managed; runtime reads are read-only  
✓ **No version enforcement weakening** — schema_version and product_version compatibility validated by middleware before Backoffice executes

**Governance References:**

- ADR-0001: Database-per-tenant isolation
- ADR-0006: Runtime authoritative time (server-side only)
- ADR-0007: Product version compatibility
- ADR-0008: Semantic versioning policy

**Status:** COMPLIANT — No architectural exceptions required.

---

## Isolation Impact Analysis

### Database Layer Access

| Layer       | Database  | Tenant Scope  | Resolver Used | Connection Pool    |
| ----------- | --------- | ------------- | ------------- | ------------------ |
| Backoffice  | tenant_db | Per workspace | Yes           | Tenant-scoped pool |
| MMC         | master_db | N/A           | No            | Global pool        |
| Frontoffice | tenant_db | Per workspace | Yes           | Tenant-scoped pool |

**Backoffice never accesses master_db.** Runtime context (modules, license state, product version) is received from middleware — not fetched from master_db by Backoffice.

### Tenant Isolation Guarantees

- Tenant is resolved from subdomain or path slug; never from request body
- Connection pool is obtained from the in-memory tenant pool map keyed by workspace_id
- No cross-tenant joins exist
- Backoffice has no knowledge of other tenants nor of global MMC configuration

### New Tables in Tenant DB

| Table              | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `roles`            | Role definitions scoped to the workspace      |
| `role_permissions` | Module-scoped permission assignments per role |
| `staff_users`      | Backoffice staff accounts in tenant DB        |
| `staff_user_roles` | Junction: staff_user ↔ role (many-to-many)    |

All four tables reside exclusively in the **tenant DB**. No equivalent tables exist in master_db via this stage.

---

## User Stories

### US-01 — License Gate

> As a staff user attempting to access Backoffice, I am blocked with a meaningful status screen when my workspace license is not ACTIVE, so that I cannot use a suspended or archived workspace.

**Acceptance Scenarios:**

- SOFT_LOCKED workspace → HTTP 423 on all routes; UI shows "Workspace unavailable" screen
- ARCHIVED workspace → HTTP 403 on all routes; UI shows "Workspace unavailable" screen
- Unknown tenant slug → HTTP 404; route does not resolve
- ACTIVE workspace → access proceeds normally through the middleware chain

---

### US-02 — Module-Aware Navigation

> As a staff user, I only see navigation items and can only reach routes for modules that my institution's license has enabled, so that I am never exposed to functionality outside the licensed product scope.

**Acceptance Scenarios:**

- Navigation sidebar dynamically renders only entries for modules present in `enabled_modules`
- A direct URL attempt for a disabled module's route does not resolve (route guard + API 403)
- An API request targeting a disabled module returns 403
- Adding a module to the license causes its navigation entry to appear without code changes

---

### US-03 — Role-Based Access Control

> As a Backoffice administrator, I can assign roles to staff users so that each staff member can access only the resources their role permits.

**Acceptance Scenarios:**

- A staff user without the required permission for an endpoint receives a 403 response
- A staff user with the required permission for an endpoint receives the expected response
- Permission checks occur in API middleware, not in frontend code
- Roles and permissions are stored in the tenant DB, not hardcoded in application code

---

### US-04 — Workspace-Scoped Authentication

> As the system, I ensure that a staff JWT token issued for one workspace cannot be used to access any other workspace, so that cross-tenant data leakage is impossible.

**Acceptance Scenarios:**

- A token with workspace_id A presented to workspace B is rejected (401 or 403)
- A token whose role no longer exists in the tenant DB is rejected
- A token with an invalid token_version is rejected
- A valid workspace-scoped token for an ACTIVE workspace is accepted

---

### US-05 — Limit Awareness Display

> As a Backoffice administrator, I can see the student and staff capacity limits for my workspace so that I can manage headcount planning, even though those limits are not enforced during bootstrap.

**Acceptance Scenarios:**

- The runtime context exposes `student_limit` and `staff_limit` to the UI layer
- The UI can display these values without making additional API calls beyond the context endpoint
- Changing the limits in the license record is reflected in the context on the next request without Backoffice recomputing

---

### US-06 — Observability & Request Tracing

> As a platform operator, every Backoffice request produces a structured log entry containing workspace identity and request tracing fields so that incidents can be diagnosed without ambiguity.

**Acceptance Scenarios:**

- Every log entry includes: `workspace_slug`, `workspace_id`, `request_id`, `route_name`
- Every authenticated log entry includes `user_id`
- No unstructured or anonymous log entries exist in Backoffice request handling
- `console.log` is not used; structured logger from `packages/logger` is used exclusively

---

### US-07 — WebSocket Lifecycle Safety

> As the system, I ensure that any WebSocket connection established in Backoffice is bound to the workspace and license state, so that a workspace suspension immediately closes active connections.

**Acceptance Scenarios:**

- WebSocket handshake validates `workspace_id`, `license_status`, and authentication token
- A WebSocket connection includes `request_id` for tracing
- When license transitions from ACTIVE to SOFT_LOCKED or ARCHIVED during an active session, the WebSocket connection is terminated
- Only one WebSocket connection per authenticated user per session is permitted

---

### US-08 — Module-Aware Layout Rendering

> As a staff user, the Backoffice shell layout renders dynamically based on the modules available to my workspace, so that the navigation always reflects the current license configuration.

**Acceptance Scenarios:**

- The `AppLayout` component renders `Sidebar`, `TopBar`, and `ContentArea` based on injected module configuration
- Navigation configuration is passed as data, not hardcoded in the component tree
- Sidebar supports collapse behavior
- All layout components use `packages/ui-system` shared components; no custom component duplicates exist

---

## Functional Requirements

### FR-01 — Middleware-Provided Runtime Context

| ID      | Requirement                                                                                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01.1 | Every Backoffice request must receive the following from middleware (not fetched by Backoffice): `workspace_id`, `workspace_slug`, `enabled_modules`, `student_limit`, `staff_limit`, `license_status`, `product_version`, `schema_version`, `request_id` |
| FR-01.2 | Backoffice logic must treat this context as authoritative and immutable for the lifetime of the request                                                                                                                                                   |
| FR-01.3 | Backoffice must never query master_db directly to obtain, recompute, or verify any of these values                                                                                                                                                        |
| FR-01.4 | Backoffice must never re-evaluate schema compatibility or license state independently                                                                                                                                                                     |

---

### FR-02 — License State Enforcement

| ID      | Requirement                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------- |
| FR-02.1 | Access to any Backoffice route requires `license_status = ACTIVE`                                     |
| FR-02.2 | `SOFT_LOCKED` status must block all routes, API endpoints, and WebSocket connections; return HTTP 423 |
| FR-02.3 | `ARCHIVED` status must block all routes, API endpoints, and WebSocket connections; return HTTP 403    |
| FR-02.4 | Unknown or unresolvable workspace slug must return HTTP 404                                           |
| FR-02.5 | UI must display a neutral "Workspace unavailable" screen for any non-ACTIVE status                    |
| FR-02.6 | No route exceptions exist in this stage; all routes are subject to license enforcement                |

---

### FR-03 — Module Visibility Enforcement

| ID      | Requirement                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| FR-03.1 | Backoffice navigation sidebar must render entries only for modules present in the injected `enabled_modules` array  |
| FR-03.2 | Routes for disabled modules must not resolve; the router must not load the route handler                            |
| FR-03.3 | API endpoints scoped to a disabled module must return HTTP 403                                                      |
| FR-03.4 | Server-side enforcement is mandatory; client-side navigation hiding alone is insufficient                           |
| FR-03.5 | No module presence must be assumed by default; all module access must be derived from `enabled_modules`             |
| FR-03.6 | The module list must not be hardcoded anywhere in Backoffice source; it must always originate from injected context |

---

### FR-04 — Base Layout Structure

| ID      | Requirement                                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------------------------- |
| FR-04.1 | Backoffice shell must implement the layout hierarchy: `AppLayout` → `Sidebar` + `TopBar` + `ContentArea`                   |
| FR-04.2 | `Sidebar` must dynamically render navigation from the injected `enabled_modules` and the authenticated user's RBAC context |
| FR-04.3 | `Sidebar` must support collapse/expand behavior                                                                            |
| FR-04.4 | Navigation configuration must be passed as injected data; the component must contain no hardcoded module names             |
| FR-04.5 | All layout and navigation components must use `packages/ui-system` shared components                                       |
| FR-04.6 | Backoffice must not introduce a parallel UI component system if a `packages/ui-system` equivalent exists                   |

---

### FR-05 — RBAC Skeleton

| ID      | Requirement                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| FR-05.1 | The following tables must exist in the tenant DB: `roles`, `role_permissions`, `staff_users`, `staff_user_roles` |
| FR-05.2 | `role_permissions` entries must be module-scoped; permissions map to a module + action pair                      |
| FR-05.3 | Supported permission actions are: `view`, `create`, `edit`, `delete`                                             |
| FR-05.4 | RBAC enforcement must occur in the API middleware layer, not in frontend code                                    |
| FR-05.5 | A request from a staff user lacking the required permission must receive HTTP 403                                |
| FR-05.6 | Division-scoped or department-scoped permissions are explicitly out of scope for this stage                      |
| FR-05.7 | The RBAC tables are initialized via tenant DB migration, not at runtime                                          |

---

### FR-06 — Authentication Boundary

| ID      | Requirement                                                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-06.1 | Backoffice requires a workspace-scoped JWT for all authenticated routes                                                                      |
| FR-06.2 | The JWT must carry `workspace_id`, `role`, and a derived `permissions` payload                                                               |
| FR-06.3 | Token validation must confirm that the token's `workspace_id` matches the resolved tenant's `workspace_id`; mismatch must reject the request |
| FR-06.4 | Token validation must confirm that the claimed role exists in the tenant DB `roles` table at request time                                    |
| FR-06.5 | Token validation must confirm `token_version` is valid (not invalidated by a forced logout or credential change)                             |
| FR-06.6 | A token issued for one workspace must never grant access to any other workspace                                                              |

---

### FR-07 — Limit Awareness Exposure

| ID      | Requirement                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| FR-07.1 | The injected runtime context must carry `student_limit` and `staff_limit` values from the license record                  |
| FR-07.2 | These values must be accessible to the Backoffice UI for informational display without additional API calls               |
| FR-07.3 | Backoffice must not enforce or recompute these limits; limit enforcement is delegated to future user-creation flow stages |
| FR-07.4 | Changes to limits in the license record must be reflected on the next request without Backoffice code changes             |

---

### FR-08 — WebSocket Integration

| ID      | Requirement                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| FR-08.1 | WebSocket connections from Backoffice must validate `workspace_id` during the handshake                      |
| FR-08.2 | WebSocket connections must validate `license_status = ACTIVE` during the handshake                           |
| FR-08.3 | WebSocket connections must validate the authentication token during the handshake                            |
| FR-08.4 | Every WebSocket connection must carry a `request_id` for distributed tracing                                 |
| FR-08.5 | If `license_status` becomes non-ACTIVE during an active WebSocket session, the connection must be terminated |
| FR-08.6 | Only one WebSocket connection per authenticated user session is permitted at any time                        |

---

### FR-09 — Structured Observability

| ID      | Requirement                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------- |
| FR-09.1 | All Backoffice request logs must include at minimum: `workspace_slug`, `workspace_id`, `request_id`, `route_name` |
| FR-09.2 | All authenticated request logs must additionally include `user_id`                                                |
| FR-09.3 | Anonymous logs (lacking workspace or request context) are not permitted in Backoffice request flows               |
| FR-09.4 | Structured logging only; `console.log` is forbidden; the shared logger from `packages/logger` must be used        |
| FR-09.5 | No sensitive data (passwords, tokens, secrets) may appear in log output                                           |

---

### FR-10 — Isolation Hard Stops

| ID      | Requirement                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| FR-10.1 | Backoffice must never directly query master_db for any purpose                                                               |
| FR-10.2 | Backoffice must never instantiate its own DB connection; all connections must come from the tenant pool via resolver context |
| FR-10.3 | Backoffice must not have awareness of other tenants, global platform configuration, or MMC-layer logic                       |
| FR-10.4 | No global DB singleton may be used inside Backoffice application code                                                        |
| FR-10.5 | Business logic (pricing, billing) and academic logic (courses, exams) must not be present in bootstrap                       |

---

## Non-Functional Requirements

### NFR-01 — Tenant Isolation

- All DB connections originate from the tenant-scoped pool; no global DB singleton
- Tenant identity resolved from host/path only; never from request body
- No cross-tenant data reference at the schema, query, or application layer

### NFR-02 — Security Enforcement

- JWT validation is server-side; frontend receives read-only rendered state
- Permission checks occur in API middleware; frontend rendering is a cosmetic hint only
- Token cross-workspace reuse must be mathematically impossible via `workspace_id` claim validation
- All SQL uses parameterized queries; no dynamic SQL interpolation

### NFR-03 — Observability Coverage

- Every request produces a structured log entry; no silent paths
- `request_id` (correlation ID) must propagate from entry middleware to WebSocket frames
- Log retention and alerting triggers are a platform-level concern (STAGE_07), not re-implemented here

### NFR-04 — Extensibility

- RBAC table schema must accommodate future addition of division-scoped permissions without requiring a breaking migration
- Module navigation configuration must be data-driven; adding a new module must not require Backoffice code changes other than route registration

### NFR-05 — Performance Baseline

- Runtime context injection (middleware) must not add more than one additional synchronous middleware step per request
- RBAC permission lookup must use indexed queries on `staff_user_roles` and `role_permissions`
- Layout component tree must not trigger additional back-end requests beyond the initial context resolution

### NFR-06 — Dependency Management

- Backoffice may import from `packages/*`; it must not import from other `apps/*`
- `packages/ui-system` is the only permitted source for shared UI components
- `packages/logger` is the only permitted source for structured logging

---

## License & Version Enforcement

| Concern                      | Answer                                          |
| ---------------------------- | ----------------------------------------------- |
| License middleware required? | Yes — mandatory on all Backoffice routes        |
| Allowed license states       | ACTIVE only                                     |
| SOFT_LOCKED response         | HTTP 423                                        |
| ARCHIVED response            | HTTP 403                                        |
| Unknown tenant response      | HTTP 404                                        |
| Limit enforcement required?  | No — exposure only; enforcement in later stages |
| schema_version checked?      | Yes — by middleware before Backoffice executes  |
| product_version checked?     | Yes — by middleware before Backoffice executes  |

---

## Data Model Changes

### New Tables — Tenant DB Only

#### `roles`

| Column       | Type        | Constraints      | Notes                  |
| ------------ | ----------- | ---------------- | ---------------------- |
| id           | uuid        | PK               |                        |
| workspace_id | uuid        | NOT NULL, FK     | Tenant-scoped          |
| name         | varchar     | NOT NULL, UNIQUE | e.g. "admin", "grader" |
| created_at   | timestamptz | NOT NULL         | Server-authoritative   |
| updated_at   | timestamptz | NOT NULL         |                        |

#### `role_permissions`

| Column  | Type    | Constraints  | Notes                              |
| ------- | ------- | ------------ | ---------------------------------- |
| id      | uuid    | PK           |                                    |
| role_id | uuid    | NOT NULL, FK | References `roles.id`              |
| module  | varchar | NOT NULL     | Module enum value (e.g. "exams")   |
| action  | varchar | NOT NULL     | One of: view, create, edit, delete |

Unique constraint: `(role_id, module, action)`.

#### `staff_users`

| Column        | Type        | Constraints            | Notes                     |
| ------------- | ----------- | ---------------------- | ------------------------- |
| id            | uuid        | PK                     |                           |
| workspace_id  | uuid        | NOT NULL               | Denormalized tenant scope |
| email         | varchar     | NOT NULL, UNIQUE       |                           |
| password_hash | varchar     | NOT NULL               |                           |
| token_version | integer     | NOT NULL, default 0    | For forced invalidation   |
| is_active     | boolean     | NOT NULL, default true |                           |
| created_at    | timestamptz | NOT NULL               | Server-authoritative      |
| updated_at    | timestamptz | NOT NULL               |                           |

#### `staff_user_roles`

| Column        | Type | Constraints  | Notes                       |
| ------------- | ---- | ------------ | --------------------------- |
| staff_user_id | uuid | NOT NULL, FK | References `staff_users.id` |
| role_id       | uuid | NOT NULL, FK | References `roles.id`       |

Primary key: `(staff_user_id, role_id)`.

### Migration Notes

- All four tables are created in a single tenant DB migration file
- Migration is forward-only
- schema_version is incremented as required by STAGE_02C versioning model
- No master_db migrations required for this stage

---

## Transaction Boundaries

| Operation            | Transactional   | Idempotent | Notes                                                   |
| -------------------- | --------------- | ---------- | ------------------------------------------------------- |
| RBAC table creation  | Yes (migration) | Yes        | Worker-executed migration; checksum-validated           |
| Runtime context read | No              | N/A        | Stateless read from injected middleware context         |
| Token validation     | No              | N/A        | Stateless claim verification                            |
| WebSocket handshake  | No              | Yes        | Repeated connection attempts must not create duplicates |
| Permission check     | No              | N/A        | Read-only lookup; no state mutation                     |

---

## Idempotency Strategy

| Concern                       | Status                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Idempotency key used?         | No — bootstrap stage has no state-mutating endpoints in scope                                                        |
| Unique constraint used?       | Yes — `staff_users.email`, `role_permissions.(role_id, module, action)`, `staff_user_roles.(staff_user_id, role_id)` |
| Replay behavior defined?      | N/A — read paths only in this stage                                                                                  |
| Double submission protection? | N/A — no submission endpoints in bootstrap scope                                                                     |

---

## Authoritative Time Usage

- All `created_at` / `updated_at` values use server-side `NOW()` from PostgreSQL
- Client-supplied timestamps are not accepted for any RBAC record
- No time-sensitive deadline logic exists in this stage (attempt engine is out of scope)

---

## Observability Requirements

| Field          | Required | Context                    |
| -------------- | -------- | -------------------------- |
| workspace_slug | Yes      | All Backoffice requests    |
| workspace_id   | Yes      | All Backoffice requests    |
| request_id     | Yes      | All Backoffice requests    |
| route_name     | Yes      | All Backoffice requests    |
| user_id        | Yes      | All authenticated requests |
| level          | Yes      | info / warn / error        |
| timestamp      | Yes      | ISO 8601, server time      |
| service        | Yes      | "backoffice"               |

All log output is structured JSON. Logger: `packages/logger`.

---

## Rate Limiting & Abuse Protection

| Endpoint Type | Policy                   | Notes                                      |
| ------------- | ------------------------ | ------------------------------------------ |
| Staff login   | 5 attempts / minute / IP | Defined in STAGE_03; enforced here         |
| Authenticated | Standard per-workspace   | Applied via API middleware                 |
| WebSocket     | 1 connection / user      | Enforced at handshake; duplicates rejected |

---

## Layer Separation Confirmation

✓ **Frontend contains no business logic** — Module visibility, RBAC decisions, and license checks are server-enforced  
✓ **API contains no grading logic** — Not in scope for this stage  
✓ **Worker contains no HTTP logic** — Migration execution only; no HTTP in worker  
✓ **MMC does not access tenant DB** — MMC operates on master_db; Backoffice operates on tenant_db  
✓ **No direct DB creation outside provisioning** — RBAC tables created via tenant migration system

---

## Failure Modes & Recovery

| Failure Scenario                        | Behavior                                                               |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Middleware context missing workspace_id | Request rejected with 500; structured error log emitted                |
| License state is non-ACTIVE             | Route blocked; appropriate HTTP code returned (423 / 403 / 404)        |
| Token workspace_id mismatch             | Request rejected with 401; log entry includes workspace_id discrepancy |
| Role not found in tenant DB             | Request rejected with 401; token effectively invalidated               |
| Invalid token_version                   | Request rejected with 401                                              |
| Disabled module API hit                 | 403 returned; structured log with module name and user_id              |
| WebSocket license becomes non-ACTIVE    | Connection terminated immediately; client receives close frame         |
| RBAC migration failure                  | Worker retries up to 3 times; DLQ on exhaustion                        |
| Logger failure                          | Fallback to stderr structured output; request still served             |

---

## Test Strategy

### Unit Tests (packages and domain logic)

- License status gate function: all four status values produce correct HTTP codes
- Module visibility filter: disabled modules removed from navigation configuration
- RBAC permission check: correct 403/200 branches for role+action combinations
- Token workspace_id validation: cross-workspace token produces rejection
- Token version validation: invalidated token_version produces rejection

### Integration Tests (Backoffice API flows)

- Full request through middleware chain with ACTIVE license → 200
- Full request with SOFT_LOCKED license → 423
- Full request with ARCHIVED license → 403
- Request with valid token but wrong workspace_id → 401/403
- Request to disabled module endpoint → 403
- Authenticated request produces structured log with all required fields
- WebSocket handshake with valid context → connection accepted
- WebSocket handshake with non-ACTIVE license → connection rejected
- WebSocket license transition to SOFT_LOCKED → connection terminated

### Schema / Migration Tests

- Tenant DB migration creates all four RBAC tables
- Unique constraints enforced on role_permissions and staff_user_roles
- Migration is idempotent when run twice against same schema

### Isolation Tests

- Backoffice handler must not reference master_db pool under any code path
- Token from workspace A must not resolve in workspace B

---

## Out of Scope

The following are explicitly not implemented in STAGE_17:

- Student management flows
- Academic content management (courses, lessons, exams)
- Business logic (billing, invoicing, pricing)
- Advanced RBAC (division-scoped, department-scoped, resource-level permissions)
- Role management UI (creating/editing roles — defined in a future stage)
- Staff user invitation or onboarding flows
- License renewal endpoints
- Feature flag system (distinct from module visibility)
- Audit log persistence (structured logging covers traceability; an audit log table is a future concern)
- Frontend form validation flows beyond route/permission guarding

---

## Dependencies

| Stage    | Name                        | Dependency Reason                                                                                    |
| -------- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| STAGE_02 | Multi-Tenancy Architecture  | Tenant resolver middleware, DB-per-tenant pool manager, workspace slug resolution                    |
| STAGE_03 | Authentication System       | Workspace-scoped JWT issuance, token_version model, staff authentication endpoints                   |
| STAGE_04 | License Engine              | license_status values, student_limit / staff_limit records, SOFT_LOCKED / ARCHIVED state transitions |
| STAGE_05 | Tenant Provisioning Service | Tenant DB bootstrap, schema_version tracking, provisioning worker                                    |
| STAGE_16 | Shared UI System            | packages/ui-system components for AppLayout, Sidebar, TopBar, ContentArea                            |

---

## Acceptance Criteria

### AC-01 — License Gate Blocks Non-ACTIVE Access

**Given** a workspace with `license_status = SOFT_LOCKED`  
**When** any Backoffice route or API endpoint is requested  
**Then** the response is HTTP 423 and the UI renders "Workspace unavailable"

**Given** a workspace with `license_status = ARCHIVED`  
**When** any Backoffice route or API endpoint is requested  
**Then** the response is HTTP 403 and the UI renders "Workspace unavailable"

**Given** an unknown workspace slug  
**When** any Backoffice route is requested  
**Then** the response is HTTP 404

---

### AC-02 — Module Disabled State Blocks UI and API

**Given** a module not present in `enabled_modules`  
**When** a staff user navigates to that module's URL directly  
**Then** the route does not load the handler and a 403 or redirect is returned

**Given** a module not present in `enabled_modules`  
**When** a staff user makes an API request to that module's endpoint  
**Then** the API returns HTTP 403

**Given** a dynamic navigation render  
**When** the sidebar is rendered  
**Then** no entry appears for any module absent from `enabled_modules`

---

### AC-03 — RBAC Blocks Unauthorized Endpoints

**Given** a staff user with a role that lacks the `create` permission for a resource  
**When** a POST request is made to that resource endpoint  
**Then** the API returns HTTP 403

**Given** a staff user with a role that has the `view` permission for a resource  
**When** a GET request is made to that resource endpoint  
**Then** the API returns the expected response

---

### AC-04 — Layout Renders Dynamically from enabled_modules

**Given** a workspace with modules [A, B]  
**When** the Backoffice shell is rendered  
**Then** the sidebar contains exactly entries for A and B, no more

**Given** the same workspace with module C later added to the license  
**When** the Backoffice shell is re-loaded  
**Then** the sidebar now contains entries for A, B, and C without application code changes

---

### AC-05 — No master_db Access Inside Backoffice

**Given** any Backoffice route handler or service function  
**When** the code is statically analyzed or integration-tested  
**Then** no direct import, reference, or call to the master_db connection pool or schema exists

---

### AC-06 — No Hardcoded Module Logic

**Given** the Backoffice navigation configuration  
**When** the source code is reviewed  
**Then** no static / hardcoded list of module names exists in layout components or route configuration; all module presence is determined from runtime-injected `enabled_modules`

---

### AC-07 — Logs Include Workspace Context

**Given** any Backoffice HTTP request  
**When** a log entry is produced  
**Then** the entry contains `workspace_slug`, `workspace_id`, `request_id`, and `route_name`

**Given** an authenticated Backoffice HTTP request  
**When** a log entry is produced  
**Then** the entry additionally contains `user_id`

---

### AC-08 — Token Mismatch Across Tenants Rejected

**Given** a valid JWT issued for workspace A  
**When** it is presented to workspace B's Backoffice  
**Then** the request is rejected (HTTP 401 or 403) and the mismatch is recorded in the structured log

---

### AC-09 — RBAC Tables Present in Tenant DB

**Given** a freshly provisioned tenant that has undergone this migration  
**When** the tenant DB schema is inspected  
**Then** the tables `roles`, `role_permissions`, `staff_users`, and `staff_user_roles` exist with the defined columns and constraints

---

### AC-10 — WebSocket Validates License and Token

**Given** a Backoffice WebSocket handshake from a SOFT_LOCKED workspace  
**When** the handshake is attempted  
**Then** the connection is refused

**Given** an active WebSocket session where the license transitions to SOFT_LOCKED  
**When** the transition occurs  
**Then** the WebSocket connection is terminated

---

### AC-11 — Layout Uses packages/ui-system

**Given** the Backoffice AppLayout, Sidebar, TopBar, and ContentArea components  
**When** their import sources are inspected  
**Then** all shared UI components are imported from `packages/ui-system` and no duplicate component implementations exist in the Backoffice app

---

### AC-12 — Token Version Invalidation

**Given** a staff user whose `token_version` has been incremented (forced invalidation)  
**When** a request is submitted with the old token  
**Then** the request is rejected (HTTP 401) and the `token_version` mismatch is recorded in the structured log

---

## Explicit Non-Goals

- This stage does not implement exam, assessment, or course logic
- This stage does not implement staff invitation or registration flows
- This stage does not implement license renewal or upgrade flows
- This stage does not implement role or permission management UI
- This stage does not implement audit log persistence
- This stage does not implement division-scoped or department-scoped RBAC
- This stage does not implement feature flags (module visibility is license-driven, not flag-driven)
- This stage does not change or extend anything in master_db

---

## Assumptions

The following assumptions were made during specification; team review recommended:

1. **STAGE_16 (Shared UI System) is complete**: `packages/ui-system` exposes `AppLayout`, `Sidebar`, `TopBar`, and `ContentArea` with module-injection support. If not, UI components must be deferred to a spike.
2. **Tenant middleware context shape is stable**: The context fields listed in FR-01.1 are already produced by STAGE_02 / STAGE_04 middleware and will not change field names.
3. **staff_users table in tenant DB separate from student users**: Staff authentication is Backoffice-only; student authentication is Frontoffice-only. The `staff_users` table is independent.
4. **Module enum values are centralized in packages/types**: A shared `ModuleEnum` type is available so that `enabled_modules` values are type-safe across API and UI.
5. **WebSocket infrastructure exists**: At minimum, the Hono/Bun WebSocket upgrade path has been established; this stage defines validation constraints, not the socket server itself.

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

All architectural trust chain links are preserved: Isolation → License → Authentication → RBAC → Runtime → Backoffice.  
No master_db access. No cross-tenant joins. No hardcoded module logic. No grading or business logic in bootstrap. No client-side permission enforcement. Migration-managed schema. Worker-executed provisioning.
