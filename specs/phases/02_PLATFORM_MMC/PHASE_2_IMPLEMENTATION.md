# PHASE 2 – MMC IMPLEMENTATION SEQUENCE (EXECUTION GUIDE)

Phase: 02_PLATFORM_MMC  
Goal: Deliver a fully functional Platform Control Layer (MMC) operating strictly on master_db.

This document is an execution sequence, not a theory plan.  
Follow it step-by-step.

---

# HOW TO USE THIS DOCUMENT

For each Step below:

1. Implement Backend stage(s)
2. Mark backend as `BACKEND_CLOSED`
3. Implement corresponding UI stage
4. Mark UI as `UI_READY`
5. Execute validation checklist
6. Only then move to next Step

No skipping layers.  
No mixing tenant DB access into MMC.  
No UI-first business logic.

---

# GLOBAL RULES (NON-NEGOTIABLE)

Throughout Phase 2:

- MMC operates on master_db only
- No direct tenant DB access
- No schema modification of tenant databases
- No lifecycle transition without License Engine
- No provisioning without Provisioning Service
- No frontend-only validation
- All mutations transactional
- All endpoints paginated where applicable
- All forms validated (Zod or equivalent)
- No raw engine errors exposed to UI
- No console/runtime errors allowed

If any of these are violated → STOP and fix before continuing.

---

# PREREQUISITE — UI RUNTIME FOUNDATION (PHASE 06 DEPENDENCY)

Before building any MMC feature UI:

- Auth module must be functional
- API client layer centralized
- Router configured with guards
- Global error handler active
- Token refresh logic implemented
- Layout system integrated

If these are not ready → do not build feature screens.

---

# STEP 1 — SHARED UI SYSTEM HARDENING

(UI foundation for all MMC features)

Backend:  
No backend work here.

UI (packages/ui-system):

Implement reusable primitives:

- AppLayout
- DataTable (pagination, filter, bulk select, column toggle)
- Modal system
- Drawer-based form layout
- Confirm dialog
- Status toggle
- Multi-language input modal

Constraints:

- Stateless components only
- No API calls inside shared UI package
- No business logic
- No direct store access
- No master_db schema knowledge

Validation:

- Reusable across MMC and Backoffice
- No duplication across apps
- No business rule leakage

Deliverable:
Stable UI component library.

---

# STEP 2 — PRODUCTS (Backend → UI)

Backend:

- Product CRUD
- Slug uniqueness enforcement
- Module selection model
- Product versioning (immutable)
- Activation / deactivation

Constraints:

- Slug immutable after creation
- Version increments on structural change
- Historical versions read-only
- Inactive product cannot create license

Validation:

- Version stored correctly
- No destructive edits
- License creation blocked for inactive products

UI:

- STAGE_UI_02_PRODUCTS

UI Rules:

- Use shared DataTable
- API via centralized client
- Slug disabled after creation
- Version history read-only
- No direct API logic inside components

UI Validation:

- Cannot create license from inactive product
- Version badge visible
- Permission respected
- Clear error mapping (409/422)

Deliverable:
Product management stable and version-safe.

---

# STEP 3 — LICENSES (Backend → UI)

Backend:

- License creation
- student_limit / staff_limit configuration
- Provisioning trigger
- Status state handling
- Version compatibility checks

Constraints:

- workspace_slug globally unique
- Product immutable after license creation
- No direct DB provisioning from MMC
- Provisioning async only

Validation:

- Duplicate slug blocked
- Provisioning job triggered
- Limits stored transactionally
- Failure handled safely

UI:

- STAGE_UI_04_LICENSES

UI Rules:

- Status badges mapped to engine states
- Provisioning visually distinct
- Limits editable only pre-provision
- Slug immutable

UI Validation:

- Spinner during provisioning
- Engine errors mapped cleanly
- Illegal edits blocked in UI

Deliverable:
License flow stable and safe.

---

# STEP 4 — LIFECYCLE CONTROLS

Backend:

- Soft lock
- Archive
- Restore
- Permanent delete (double confirm)
- Audit logging

Constraints:

- Must call License Engine
- Illegal transitions blocked
- Archive required before delete
- All actions audited

Validation:

- SOFT_LOCKED blocks login
- ARCHIVED blocks resolver
- Restore re-enables
- Delete removes safely

UI:

- Integrated in STAGE_UI_04_LICENSES

UI Rules:

- Confirm dialog for destructive actions
- Typed confirmation for delete
- Buttons state-driven
- No direct state mutation

UI Validation:

- Illegal transitions never clickable
- States visually distinct
- Delete hidden unless allowed

Deliverable:
Lifecycle strictly engine-driven.

---

# STEP 5 — AFFILIATES (Backend → UI)

Backend:

- Affiliate CRUD
- Usage limit enforcement
- Expiration enforcement
- Commission validation

Constraints:

- Applies to B2B only
- No tenant-level student logic
- Expired affiliate unusable

Validation:

- Usage limits enforced
- Expiration enforced
- Commission validated server-side

UI:

- STAGE_UI_03_AFFILIATES

UI Rules:

- Commission validated client + server
- Expired flagged visually
- Usage count visible
- No student logic inside MMC

UI Validation:

- Expired affiliate not selectable
- Rate-limit errors clear
- Promo input validated

Deliverable:
Affiliate system safe and bounded.

---

# STEP 6 — MMC MEMBERS & RBAC

Backend:

- Member CRUD
- Role CRUD
- Permission matrix
- Invite flow
- Audit logging

Constraints:

- Permissions enforced server-side
- No frontend-only protection
- Immediate permission effect
- Secure invite tokens

Validation:

- 403 returned correctly
- Role updates immediate
- Audit entry created

UI:

- STAGE_UI_06_MMC_MEMBERS

UI Rules:

- Permission matrix read-only unless super-admin
- UI relies on backend 403
- State refresh after role change
- Secure invite flow

UI Validation:

- 403 handled gracefully
- Permission drift impossible
- Activity log visible

Deliverable:
MMC RBAC fully enforced.

---

# STEP 7 — MMC DASHBOARD

Backend:

- License metrics
- Revenue summary
- Affiliate statistics
- Status distribution

Constraints:

- master_db only
- Indexed queries
- Optimized aggregations

Validation:

- Permission filtering applied
- Performance acceptable
- No blocking queries

UI:

- STAGE_UI_05_MMC_DASHBOARD

UI Rules:

- No heavy browser computation
- Server-provided aggregates only
- Widgets permission-driven
- Graceful loading states

UI Validation:

- Widgets hidden if unauthorized
- No blocking calls
- No raw DB assumptions

Deliverable:
Dashboard performant and secure.

---

# STEP 8 — FULL MMC SYSTEM VALIDATION (EXIT GATE)

Execute:
STAGE_TEST_01_MMC_SYSTEM_VALIDATION

Must Validate:

- API contract stability
- RBAC enforcement
- Lifecycle enforcement
- Provisioning flow
- Affiliate application flow
- Isolation boundaries
- Security abuse cases
- Load & concurrency behavior
- E2E flows (Playwright)
- Integration tests against real DB
- CI fully green

Failure Policy:

- Phase status reverts to BACKEND_CLOSED
- Root cause documented
- Fix applied
- Validation fully re-run

No Phase 3 work begins before this passes.

---

# PHASE 2 COMPLETE WHEN:

- Product → License → Provisioning stable
- Lifecycle engine fully enforced
- Affiliates stable
- RBAC enforced
- Dashboard optimized
- Shared UI system abstracted
- No tenant DB access anywhere in MMC
- UI strictly consumes backend contracts
- No business logic duplicated in UI
- All UI stages marked UI_READY
- All backend stages marked BACKEND_CLOSED
- STAGE_TEST_01_MMC_SYSTEM_VALIDATION passed

If any master/tenant boundary is violated,
Phase 2 must be refactored before Phase 3.

---

Next Phase:
03_BACKOFFICE_CORE
