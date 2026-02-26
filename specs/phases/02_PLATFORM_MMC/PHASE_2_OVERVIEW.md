# PHASE 2 – PLATFORM MMC (ARCHITECTURAL OVERVIEW)

Version: 2.0  
Status: Authoritative  
Scope: Platform Management Console (MMC)

---

# WHAT THIS PHASE BUILDS

Phase 2 builds the **commercial and operational control layer of Zidney**.

This is the platform authority layer.

It manages:

- Products
- Licenses
- License lifecycle
- Workspace provisioning triggers
- Platform-level affiliates (B2B)
- Internal platform members (RBAC)
- Master-level analytics

It does **NOT** manage:

- Academic data
- Students
- Exams
- Attempts
- Certificates
- Tenant runtime logic

Phase 2 controls the platform.  
Phase 3 controls the tenants.

---

# ARCHITECTURAL POSITION

MMC operates **exclusively on master_db**.

MMC must never:

- Connect directly to tenant databases
- Modify tenant academic data
- Access student or attempt data
- Drop tenant databases
- Bypass the License Engine
- Bypass the Provisioning Service

All tenant-impacting operations must flow through:

- License Engine
- Tenant Provisioning Service
- Tenant Resolver (runtime layer only)

MMC is a command layer — not a runtime layer.

---

# MASTER DATA OWNED BY MMC

MMC owns only master-level entities:

- products
- product_versions
- licenses
- tenants_registry
- affiliates
- mmc_users
- roles
- permissions
- platform_audit_logs

MMC must never read/write:

- students
- attempts
- exams
- subscriptions
- certificates
- tenant runtime logs

If master/tenant boundary is violated → architecture is compromised.

---

# CORE DOMAINS INSIDE PHASE 2

Phase 2 is divided into structured domains:

1. Product Management
2. License Management
3. License Lifecycle Control
4. Provisioning Trigger
5. Affiliates (B2B Promo Codes)
6. MMC Members & RBAC
7. MMC Dashboard
8. Shared UI System

Each domain has:

- Backend Stage
- UI Stage
- Validation Stage

No domain is considered complete without all three.

---

# PRODUCT MODEL

Products are the commercial configuration layer.

A Product defines:

- Name
- Description
- Enabled modules
- Base configuration
- Status
- Version

Key constraints:

- Slug immutable
- Versions immutable after publish
- Structural changes require new version
- Existing licenses stay pinned to version
- Upgrade must be explicit

No automatic breaking upgrades allowed.

Version compatibility must align with:

- schema_version
- runtime compatibility (Phase 1 enforcement)

---

# LICENSE MODEL

License represents a purchased workspace contract.

License defines:

- workspace_slug (globally unique)
- product_id
- version_id
- student_limit
- staff_limit
- lifecycle state

Lifecycle transitions are engine-controlled.

MMC can request transitions, but cannot:

- Skip lifecycle states
- Force deletion without archive
- Drop tenant DB
- Bypass soft-lock windows

All lifecycle changes must:

- Go through License Engine
- Be transactional
- Be audited
- Be idempotent where applicable

---

# PROVISIONING MODEL

License creation triggers:

1. Status = PROVISIONING
2. Async job to Provisioning Service
3. Transition to ACTIVE only on success

MMC must:

- Show provisioning status clearly
- Block lifecycle overrides during provisioning
- Log provisioning failures

MMC must never create tenant DB directly.

---

# AFFILIATES (B2B ONLY)

Affiliates apply only to license purchases.

Affiliate contains:

- promo_code
- discount_percentage
- commission_percentage
- usage_limit
- expiration
- status

Constraints:

- Platform-level only
- No student-level discount logic
- No tenant academic interaction
- Expired affiliate unusable
- Usage limits enforced transactionally

Backoffice promo codes are separate (Phase 3).

---

# MMC MEMBERS & PERMISSIONS

MMC members are internal platform operators.

Roles include:

- Platform Admin
- Sales
- Operations
- Finance

Permission model:

- Strict RBAC
- API-level enforcement only
- No frontend-only protection
- Immediate effect on role change
- Audit trail required

Permission categories:

- Organization Settings
- Product Management
- License Management
- Affiliate Management
- Members Management
- Reporting

---

# MMC DASHBOARD

Dashboard shows master-level metrics only:

- Total clients
- Active licenses
- Soft-locked licenses
- Archived licenses
- Revenue summary
- Revenue distribution
- Affiliate usage

Constraints:

- master_db only
- Aggregated queries only
- No tenant DB access
- Permission-filtered visibility

MMC dashboard is operational visibility, not tenant analytics.

---

# SHARED UI SYSTEM PRINCIPLES

MMC must use:

packages/ui-system

Shared components must be:

- Stateless
- Business-logic free
- API-agnostic
- Reusable across apps

Required primitives:

- DataTable
- Filtering system
- Pagination
- Column visibility
- Bulk actions
- Confirm dialog
- Drawer forms
- Status toggles
- Multi-language modal

No business logic inside shared components.

UI must strictly consume backend contracts.

---

# AUDIT REQUIREMENTS

Every critical MMC action must create audit entry:

- Actor (mmc_user_id)
- Action
- Target entity
- Previous state
- New state
- Timestamp

Audit logs must be immutable.

No destructive operation without audit trail.

---

# STABILITY GUARANTEES

MMC must guarantee:

- No tenant DB access
- No direct DB provisioning
- No lifecycle mutation without engine validation
- No destructive action without archive
- No bypass of provisioning state
- No permission drift
- No un-audited mutation

MMC is the commercial authority layer.

If MMC is unstable, institutional trust collapses.

---

# PHASE 2 COMPLETE WHEN

Phase 2 is considered complete when:

- Product CRUD + versioning stable
- License CRUD + lifecycle enforcement stable
- Provisioning trigger stable
- Affiliates stable
- RBAC fully enforced
- Dashboard accurate
- Shared UI system abstracted
- All actions audited
- No master/tenant boundary violation
- Backend stages marked BACKEND_CLOSED
- UI stages marked UI_READY
- STAGE_TEST_01_MMC_SYSTEM_VALIDATION passed

Only then may Phase 3 begin.

---

Next Phase:
03_BACKOFFICE_CORE
