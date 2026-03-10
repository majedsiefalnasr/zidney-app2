# STAGE 17 – Tenant Bootstrap

Phase: 03_BACKOFFICE_CORE  
Domain: 01_FOUNDATION  
Scope: Backoffice runtime initialization & tenant enforcement  
Database: Tenant DB only

---

## Stage Status

Status: PRODUCTION READY Risk Level: MEDIUM Closure Date: 2026-02-28

Implementation: COMPLETE Tasks: 31 / 31 completed

Scope Closed:

- Backoffice REST + WebSocket bootstrap
- GET /backoffice/context endpoint
- License enforcement middleware (enabled_modules + product_version injection)
- RBAC guard middleware (Redis cache + DB fallback; backoffice\_ table prefix)
- Module guard middleware
- Tenant RBAC skeleton migration (backoffice_roles, backoffice_role_permissions,
  backoffice_staff_users, backoffice_staff_user_roles)
- Vue 3 SPA scaffold with Pinia context store, Vue Router v4, WS plugin
- Dockerfile builder-deps stage + nginx WS + SPA location blocks
- 67 tests across 7 test files (all passing)

Deferred Scope:

- Academic module logic (planned for academic-features stage)
- Limit enforcement during user creation (requires user management stage)
- Division/department-scoped RBAC (architectural pattern to be defined in later stage)
- WebSocket event bus for license transitions (requires event infrastructure)

Constitutional Compliance:

- ADR-0001 Database-per-tenant isolation enforced
- ADR-0006 Server-authoritative time enforced
- ADR-0007 Version compatibility enforced (product_version injected)
- ADR-0008 Semantic versioning enforced (migration 20260228*001*\*, schema_version runner)
- Implementation compliant with Zidney Constitution v1.2.0

Notes: Stage is production ready. No structural backend modifications allowed. Modifications require
a new migration stage.

---

## 1. Objective

Establish a deterministic and license-aware runtime foundation for Backoffice.

This stage initializes:

- Tenant-resolved request context
- License state enforcement (ACTIVE required)
- Product module injection
- Student and staff limits exposure
- Product version exposure
- RBAC enforcement skeleton
- Module-aware layout rendering

No academic structure or business logic is implemented in this stage.

This stage defines the runtime boundary for Backoffice.

---

## 2. Runtime Preconditions

Backoffice runtime depends on:

- STAGE_02_MULTI_TENANCY_ARCHITECTURE
- STAGE_03_AUTHENTICATION_SYSTEM
- STAGE_04_LICENSE_ENGINE
- STAGE_05_TENANT_PROVISIONING_SERVICE

Tenant resolution and license validation must already occur in middleware before Backoffice logic
executes.

Backoffice must assume:

- Tenant context is valid
- License state has been validated
- Schema version is compatible

Backoffice must never resolve tenants independently.

---

## 3. Runtime Context Injection

Every Backoffice request must receive the following context from middleware:

- workspace_id
- workspace_slug
- enabled_modules (array of module enums)
- student_limit
- staff_limit
- license_status
- product_version
- schema_version
- request_id

Backoffice must treat this context as authoritative.

Backoffice must not:

- Query master_db
- Recompute license state
- Re-evaluate schema compatibility

---

## 4. License State Enforcement

Backoffice access requires:

license_status = ACTIVE

If status != ACTIVE:

- Block all Backoffice routes
- Block all API endpoints
- Block WebSocket connections
- Return structured error response

Allowed HTTP responses:

- 423 for SOFT_LOCKED
- 403 for ARCHIVED
- 404 for unknown tenant

UI must render a neutral "Workspace unavailable" screen.

No route exceptions allowed except explicitly defined renewal endpoints (if implemented later).

---

## 5. Module Visibility Contract

enabled_modules is derived from product configuration and injected by middleware.

Backoffice must:

- Hide disabled modules from navigation
- Prevent disabled module routes from loading
- Reject API requests targeting disabled modules

Server-side enforcement is mandatory.

Client-side hiding alone is insufficient.

If a module is not licensed:

- API must return 403
- Route must not resolve
- Menu must not render entry

No module assumptions allowed.

---

## 6. Base Layout Structure

Backoffice layout must follow:

AppLayout ├── Sidebar ├── TopBar └── ContentArea

Sidebar rules:

- Dynamically render modules based on enabled_modules
- Respect RBAC permissions
- Support collapse behavior
- No hardcoded module list

Navigation configuration must be injected.

Shared UI system (packages/ui-system) must be used.

---

## 7. Backoffice RBAC Skeleton

Minimal RBAC structure must exist inside tenant DB:

Tables:

- roles
- role_permissions
- staff_users
- staff_user_roles (junction)

Permissions are module-scoped.

Supported actions:

- view
- create
- edit
- delete

RBAC enforcement must occur in API middleware layer.

Front-end must not decide permissions.

Division-scoped or department-scoped permissions are not implemented in this stage.

---

## 8. Authentication Boundary

Backoffice requires:

- Workspace-scoped JWT
- role claim
- permissions derived from role

Token validation must:

- Confirm workspace_id matches resolved tenant
- Confirm role exists in tenant DB
- Confirm token_version valid

Token must never allow cross-workspace usage.

---

## 9. Limit Awareness Exposure

student_limit and staff_limit must be:

- Injected into runtime context
- Exposed to UI for informational display
- Not recalculated by Backoffice

Actual enforcement occurs during user creation flows (later stage).

Bootstrap only exposes limits.

---

## 10. WebSocket Integration Rule

If Backoffice uses WebSockets:

- Connection must validate workspace_id
- Must validate license_status
- Must validate authentication token
- Must include request_id tracing

If license becomes non-ACTIVE during session:

- Connection must be terminated

---

## 11. Observability Requirements

All Backoffice logs must include:

- workspace_slug
- workspace_id
- request_id
- user_id (if authenticated)
- route_name

No anonymous logs allowed.

Structured logging only.

---

## 12. Validation Criteria

Stage complete when:

- Backoffice routes require ACTIVE license
- Module disabled state blocks UI and API
- RBAC blocks unauthorized endpoints
- Layout renders dynamically from enabled_modules
- No master_db access inside Backoffice
- No hardcoded module logic
- Logs include workspace context
- Token mismatch across tenants rejected

---

## 13. Not Allowed

- Direct master_db queries
- Hardcoded modules
- Hardcoded license checks
- Cross-tenant access
- Business logic inside bootstrap
- Academic logic inside bootstrap
- Skipping RBAC enforcement
- Using global DB instance

---

## 14. Isolation Principle

Backoffice is a pure tenant runtime environment.

It must never know:

- Other tenants
- Platform-level MMC logic
- Global configuration outside injected context

Tenant isolation must remain absolute.

Backoffice development must not proceed to academic modules until this stage is validated and
stable.
