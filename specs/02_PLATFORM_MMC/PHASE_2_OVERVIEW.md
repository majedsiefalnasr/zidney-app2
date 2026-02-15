# PHASE 2 – Platform MMC

Version: 1.1  
Status: Authoritative  
Scope: Platform Management Console (MMC)

---

## Objective

Build the MMC (Master Management Console) as the platform control layer responsible for:

- Products
- Licenses
- License lifecycle management
- Workspace provisioning triggers
- Platform-level affiliates (B2B)
- Internal platform members (RBAC)
- Platform-level analytics (master scope only)

MMC manages the platform.

MMC does not manage academic content, student data, or tenant runtime data.

---

## Architectural Position

MMC operates exclusively on:

master_db

MMC must never:

- Connect to tenant databases directly
- Modify tenant academic data
- Access student, attempt, or exam data
- Bypass the Provisioning Service
- Bypass the License Engine middleware

All tenant-related operations must flow through:

- License Engine
- Tenant Provisioning Service
- Tenant Resolver (runtime only)

---

## Functional Domains

Phase 2 includes the following domains:

- Products Management
- License Management
- License Lifecycle Control
- Provisioning Trigger
- Affiliates (B2B Promo Codes)
- MMC Members (Platform RBAC)
- MMC Dashboard
- Shared MMC UI System

Each domain is implemented in its own stage specification.

---

## Data Scope

MMC controls master-level entities only:

- products
- product_versions
- licenses
- tenants_registry
- affiliates
- mmc_users
- roles
- permissions
- audit_logs (platform level)

MMC must not read or write:

- attempts
- students
- exams
- subscriptions
- certificates
- tenant runtime logs

Those belong strictly to tenant databases.

---

## Product Model

Product is the commercial configuration layer.

Product defines:

- name
- description
- enabled_modules
- base configuration
- status
- version

There is no Model abstraction layer.

Products evolve independently.

Each product version must be immutable once published.

---

## Product Versioning

When a product changes:

- A new product_version must be created
- Existing licenses remain on their current version
- Upgrade availability must be recorded
- Workspace must explicitly opt-in to upgrade

No automatic breaking upgrades are allowed.

Version compatibility must align with:

- schema_version
- runtime compatibility enforcement (Phase 1)

---

## License Management

MMC must allow:

- Create license
- Edit license limits
- Change lifecycle state (via License Engine)
- Trigger provisioning (async job)
- Archive workspace
- Restore workspace
- Permanently delete workspace (manual confirmation only)

All license operations must:

- Be validated by lifecycle rules
- Be executed through License Engine
- Be audited
- Be idempotent where applicable

MMC must not mutate tenant registry directly.

---

## License Lifecycle Enforcement

Lifecycle state transitions are controlled by the License Engine only.

MMC UI may request transitions, but cannot:

- Skip lifecycle states
- Force deletion without archive
- Bypass soft-lock window
- Directly drop databases

All destructive actions must:

- Require explicit confirmation
- Be audited
- Respect archive preconditions

---

## Provisioning Trigger Model

License creation triggers:

- License status = PROVISIONING
- Asynchronous job dispatch to Provisioning Service
- State transition to ACTIVE only after success

MMC must:

- Display provisioning state
- Block manual lifecycle overrides during provisioning
- Log provisioning failures

Provisioning logic is not implemented inside MMC.

---

## Affiliates (Platform-Level)

Affiliates apply only to:

B2B license purchases.

Affiliate includes:

- promo_code
- discount_percentage
- commission_percentage
- usage_limit
- status

Affiliate logic must not interact with tenant-level student purchases.

Workspace-level promo codes are handled separately in Backoffice.

---

## MMC Members

MMC members are internal platform users:

- Platform admins
- Sales
- Operations
- Finance

Stored in master_db only.

Must support:

- Invite member
- Assign role
- Assign organizational grouping (team/group/department)
- Enable/disable member

MMC RBAC applies at full-platform scope.

No partial product access model is supported in Phase 2.

---

## Permission Model

MMC uses strict RBAC.

Permission categories include:

- Organization Settings
- Product Management
- License Management
- Client Management
- Affiliate Management
- Members Management
- Reporting

Permissions include:

- view
- create
- edit
- delete

Permission checks must be enforced at API level.

No frontend-only enforcement allowed.

---

## MMC Dashboard Scope

Dashboard aggregates master-level metrics only:

- Total clients
- Active licenses
- Soft-locked licenses
- Archived licenses
- Revenue summary
- Revenue by location
- Affiliate usage statistics

Dashboard must:

- Query master_db only
- Avoid tenant DB access
- Use aggregated data only
- Respect permission visibility

---

## Shared MMC UI System

MMC must use:

packages/ui-system

Shared components must include:

- DataTable
- Filter system
- Column visibility controls
- Pagination
- Bulk actions
- Status toggler
- Translation modal
- Confirm dialog
- Drawer-based form pattern

UI system must:

- Be reusable by Backoffice
- Avoid business logic
- Enforce consistent interaction patterns

No business logic in UI components.

---

## Audit Requirements

All MMC actions must generate audit entries:

- Actor (mmc_user_id)
- Action type
- Target entity
- Previous state (if applicable)
- New state
- Timestamp

Audit logs must be immutable.

No critical action may occur without audit trail.

---

## Stability Constraints

MMC must:

- Never access tenant DB directly
- Never create tenant DB manually
- Never mutate lifecycle without engine validation
- Never allow destructive action without archive
- Never skip provisioning state

MMC is the commercial and operational authority of the platform.

If MMC lifecycle logic is unstable, institutional trust is compromised.

---

## Phase Completion Criteria

Phase 2 is complete when:

- Product CRUD works with versioning
- License CRUD works with lifecycle enforcement
- Async provisioning trigger works
- Affiliate management works
- MMC RBAC enforced
- Dashboard metrics correct
- Shared UI system implemented and reusable
- All actions audited
- No direct tenant DB access anywhere in MMC

---

## Dependency Gate

Backoffice implementation must not begin until:

- License creation works
- Provisioning works
- Lifecycle enforcement works
- Resolver isolation verified
- Audit logging operational

---

Next Phase:
03_BACKOFFICE_CORE
