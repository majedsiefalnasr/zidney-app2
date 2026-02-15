# PHASE 2 – IMPLEMENTATION PLAN

Phase: 02_PLATFORM_MMC
Objective: Build Platform Control Layer (MMC)
Status: Authoritative Execution Sequence

---

## Execution Principles

Phase 2 is built strictly on top of Phase 1.

Phase 2 must not:

- Access tenant databases directly
- Modify tenant schema
- Bypass License Engine validation
- Bypass Tenant Provisioning Service
- Perform lifecycle transitions without engine enforcement

All MMC logic must operate on master_db only.

If master/tenant boundaries are violated, implementation must stop.

---

## Implementation Order (Strict)

The following sequence is mandatory.
No stage may begin before the previous stage passes validation.

1. Shared UI System
2. Products Management
3. License Management
4. Lifecycle Controls
5. Affiliates
6. MMC Members & RBAC
7. Dashboard & Reporting

---

## Step 1 – Shared UI System

Implement in packages/ui-system:

- AppLayout
- DataTable (filter, pagination, bulk select, column toggle)
- Modal system
- Drawer-based form layout
- Confirm dialog
- Status toggle
- Multi-language input modal

Constraints:

- Stateless components only
- No API calls inside UI package
- No business logic inside UI components
- No direct store access

Validation Gate:

- Components reusable across MMC and Backoffice
- No duplication across apps
- No coupling to master_db schema

Stop if UI logic begins to leak business rules.

---

## Step 2 – Products Management

Implement:

- Product CRUD
- Slug uniqueness enforcement
- Module selection model
- Product version creation (immutable versioning)
- Product activation / deactivation

Constraints:

- Slug immutable after creation
- Product version must increment on structural change
- Existing licenses remain on previous version

Validation Gate:

- Inactive product cannot create new license
- Product version stored correctly
- No destructive edits to historical versions

---

## Step 3 – License Management

Implement:

- License creation
- Limit configuration (student_limit, staff_limit)
- Async provisioning trigger
- Status visualization
- Version compatibility display

Constraints:

- workspace_slug globally unique
- Product cannot change after license creation
- License enters PROVISIONING state before ACTIVE
- No direct DB creation from MMC

Validation Gate:

- License triggers provisioning job
- Duplicate slug blocked
- Limits stored correctly
- Provisioning failure handled safely

---

## Step 4 – Lifecycle Controls

Implement UI and API controls for:

- Soft lock
- Archive
- Restore
- Permanent delete (double confirmation required)

Constraints:

- Lifecycle transitions must call License Engine
- Illegal transitions blocked
- Archive required before delete
- All actions audited

Validation Gate:

- SOFT_LOCKED blocks workspace login
- ARCHIVED blocks resolver access
- Restore re-enables access
- Delete removes tenant safely

---

## Step 5 – Affiliates

Implement:

- Affiliate CRUD
- Usage limit enforcement
- Status enforcement
- Reporting queries

Constraints:

- Applies only to B2B license purchase
- No tenant-level student interaction
- Expired affiliate cannot apply

Validation Gate:

- Usage limit enforced
- Expiration enforced
- Commission percentage validated

---

## Step 6 – MMC Members & RBAC

Implement:

- MMC member CRUD
- Role CRUD
- Permission matrix
- Invite flow
- Activity log integration

Constraints:

- Permissions enforced at API layer
- No frontend-only protection
- No partial-product access model in Phase 2

Validation Gate:

- Unauthorized action returns 403
- Role update affects permissions immediately
- Audit log entry created for sensitive actions

---

## Step 7 – MMC Dashboard

Implement:

- License metrics
- Revenue summary
- Affiliate statistics
- Status distribution

Constraints:

- Query master_db only
- No tenant DB access
- Indexed queries only
- Heavy aggregation must be optimized

Validation Gate:

- Permission filtering applied
- Dashboard loads within acceptable threshold
- No blocking queries

---

## Audit Requirements

All sensitive actions must generate audit records:

- Actor (mmc_user_id)
- Action type
- Target entity
- Previous state (if applicable)
- New state
- Timestamp

Audit logs must be immutable.

---

## Completion Criteria

Phase 2 is complete only if:

- Product → License → Provisioning flow stable
- Lifecycle transitions enforced via engine
- Async provisioning verified
- Affiliates stable
- MMC RBAC fully enforced
- Dashboard stable and optimized
- Shared UI system abstracted and reused
- No direct tenant DB access exists anywhere in MMC

If any boundary between MMC and tenant runtime is violated,
Phase 2 must be refactored before Phase 3 begins.

---

Next Phase:
03_BACKOFFICE_CORE
