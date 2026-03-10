# PHASE 3 – BACKOFFICE CORE (ARCHITECTURAL OVERVIEW)

Version: 2.0  
Status: Authoritative  
Scope: Tenant-Level Academic & Operational Control Panel

---

# WHAT THIS PHASE BUILDS

Phase 3 builds the **institutional operating system** of Zidney.

If Phase 2 is the commercial authority layer,  
Phase 3 is the tenant execution layer.

This phase enables each licensed workspace to:

- Define academic structure
- Manage staff and students
- Configure exams
- Classify content
- Enforce subscription limits
- Manage media, notifications, ads
- Operate institution-level dashboard

Phase 3 runs strictly inside tenant databases.

No master-level mutation is allowed here.

---

# ARCHITECTURAL POSITION

Backoffice exists only after:

- License status = ACTIVE
- Tenant provisioning completed
- Schema version validated
- Tenant resolver attached

Every request must pass through:

1. Tenant Resolver Middleware
2. License Validation Middleware
3. Schema Version Enforcement
4. RBAC Enforcement

Backoffice must never:

- Access master_db directly
- Mutate license lifecycle
- Trigger provisioning
- Modify products
- Access other tenants
- Execute cross-database joins

Backoffice is tenant-isolated by design.

---

# DATA OWNERSHIP MODEL

Phase 3 owns tenant-level entities only:

- divisions
- departments
- groups
- hierarchy trees
- teams
- semesters
- subjects
- lessons
- categories
- tags
- baskets
- exams
- questions
- users (staff, students)
- subscriptions (tenant-level)
- invoices (tenant-level)
- media
- notifications
- feedback
- ads
- dashboards

Backoffice must never read/write:

- products
- product_versions
- licenses
- affiliates (platform-level)
- mmc_users
- platform audit logs

Master/tenant boundaries are absolute.

---

# EXECUTION MODEL

Phase 3 is executed in structured layers:

1. Shell & Security Layer
2. Academic Structure
3. Classification Layer
4. Exam Engine Core
5. User Management
6. Commercial Layer
7. Media & Communication
8. Dashboard
9. System Validation

Each layer requires:

- Backend implementation
- UI implementation
- Validation stage
- Isolation verification
- Permission verification

No layer is considered stable until UI and validation pass.

---

# TENANT ISOLATION RULES

All queries must:

- Use tenantDb from request context
- Be scoped to workspace_slug
- Avoid global identifiers

Forbidden:

- Cross-tenant queries
- Shared student tables
- Shared attempt tables
- Cross-database joins
- Raw SQL bypassing ORM validation

Isolation violations invalidate the phase.

---

# DIVISION MODEL (CORE RULES)

Division is shared by staff and students.

Student rules:

- Must belong to exactly one division
- Cannot belong to multiple divisions

Staff rules:

- May belong to multiple divisions

If divisions are disabled:

- Default division enforced
- All records mapped automatically
- Irreversible confirmation required

Division logic must be server-enforced.

---

# ROLE & PERMISSION MODEL

Backoffice RBAC:

- API-enforced only
- No frontend-only protection
- Role resolved per request
- No division-level permissions (Phase 3 scope)

Permission updates must:

- Take effect immediately
- Invalidate stale sessions if required
- Be auditable

---

# WORKFLOW ENGINE PRINCIPLES

Status-enabled entities follow controlled transitions.

Example flow:

Completed → Under Review → Approved → Enabled

Rules:

- Server-side validation only
- Transition permission-controlled
- Audit record created
- Illegal transitions blocked

Workflow logic must remain deterministic.

---

# SUBSCRIPTION ENFORCEMENT

Backoffice enforces:

- Student limit
- Staff limit
- Plan restrictions

Limit checks must be:

- Transaction-safe
- Concurrency-safe
- Atomic (COUNT + INSERT pattern)

Subscription expiration:

- Blocks content access
- Does not block login
- Allows certificate viewing

Commercial data in Phase 3 is tenant-scoped only.

---

# OBSERVABILITY REQUIREMENTS

Every Backoffice request must include:

- workspace_slug
- request_id
- user_id

Sensitive operations must:

- Emit structured logs
- Create audit records
- Record before/after states

Logging must never expose:

- Raw tokens
- Sensitive secrets
- Cross-tenant identifiers

---

# STABILITY GUARANTEES

Backoffice must guarantee:

- Deterministic behavior
- Schema-version compatibility
- Strict transaction boundaries
- No isolation leakage
- No RBAC bypass
- No master_db dependency
- No frontend-only enforcement

If any of these are broken, Phase 3 must be halted.

---

# PHASE 3 COMPLETE WHEN

Phase 3 is complete only when:

- All backend stages marked BACKEND_CLOSED
- All UI stages marked UI_READY
- STAGE_TEST_01_BACKOFFICE_SYSTEM_VALIDATION passed
- No cross-tenant leakage detected
- No permission drift
- No lifecycle bypass
- No console/runtime errors
- No API contract drift
- Isolation proven via automated tests

Only then may Phase 4 begin.

---

Next Phase: 04_RUNTIME
