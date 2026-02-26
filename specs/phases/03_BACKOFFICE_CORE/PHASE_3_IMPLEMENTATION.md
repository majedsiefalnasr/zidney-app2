# PHASE 3 – BACKOFFICE IMPLEMENTATION SEQUENCE (EXECUTION GUIDE)

Phase: 03_BACKOFFICE_CORE  
Goal: Deliver a fully functional, tenant-isolated Backoffice application (Backend + UI + Validation)

This document is an execution sequence, not a theory document.  
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

No skipping. No parallel jumping across structural layers.

---

# GLOBAL RULES (NON-NEGOTIABLE)

Throughout Phase 3:

- All data must stay tenant-scoped
- No master_db access from backoffice runtime
- License middleware must run on all protected routes
- RBAC must be enforced server-side
- No UI-only permission logic
- All mutations transactional
- All list endpoints paginated
- All forms validated (Zod or equivalent)
- No console errors allowed

If any rule is violated → STOP and fix before continuing.

---

# STEP 1 — BACKOFFICE SHELL (FOUNDATION)

Backend:

- Tenant bootstrap logic
- License middleware enforcement
- Base RBAC structure
- Module visibility control

UI:

- STAGE_UI_01_BACKOFFICE_SHELL
  - Layout
  - Sidebar
  - Router setup
  - Auth guard
  - Permission guard
  - Error boundary

Validation Checklist:

- Tenant resolved correctly
- License states enforced
- Unauthorized user blocked
- No cross-tenant access possible
- No master_db usage

Deliverable:
Backoffice loads safely with protected routes.

---

# STEP 2 — WORKSPACE SETTINGS

Backend:

- Settings CRUD
- Language config
- Timezone config
- Branding tokens

UI:

- Settings pages
- Controlled forms
- Theme preview

Validation:

- Settings stored only in tenant DB
- Language fallback works
- Theme tokens validated
- No leakage between tenants

Deliverable:
Tenant can safely configure workspace.

---

# STEP 3 — TRANSLATION SYSTEM

Backend:

- Translation table
- Entity linking
- Fallback logic

UI:

- Translation management screens
- Language coverage indicator

Validation:

- Missing translation falls back safely
- No entity corruption
- Performance acceptable

Deliverable:
Multi-language system operational.

---

# STEP 4 — STATUS WORKFLOW ENGINE

Backend:

- Generic state machine
- Transition validation
- Role-based transitions
- Audit logging

UI:

- Workflow controls in entities
- Transition buttons permission-aware

Validation:

- Illegal transitions blocked
- Unauthorized role blocked
- Audit log generated

Deliverable:
Reusable workflow engine stable.

---

# STEP 5 — ACADEMIC STRUCTURE

Backend (in order):

1. Divisions
2. Departments
3. Groups
4. Staff hierarchy
5. Teams
6. Semesters
7. Subjects

UI:

- STAGE_UI_02_ACADEMIC_STRUCTURE

Validation:

- No circular hierarchy
- Division isolation respected
- Access rules enforced
- Transaction safety verified

Deliverable:
Academic hierarchy complete and stable.

---

# STEP 6 — CONTENT CLASSIFICATION

Backend:

- Categories
- Category values
- Tags
- MCQ basket model

UI:

- Included inside STAGE_UI_03_EXAM_MANAGEMENT

Validation:

- Filtering accurate
- Query optimized
- No redundant joins

Deliverable:
Content tagging and filtering operational.

---

# STEP 7 — USER MANAGEMENT

Backend:

- Staff management
- Student management
- Role assignment
- Division assignment
- Limit enforcement (transaction-safe)

UI:

- STAGE_UI_04_USER_MANAGEMENT

Validation:

- Student limit race-condition safe
- Staff limit race-condition safe
- Disabled users blocked
- RBAC enforced at API level

Deliverable:
User system fully enforced.

---

# STEP 8 — COMMERCIAL LAYER

Backend:

- Plans
- Subscriptions
- Promocodes
- Invoices
- Manual payment records

UI:

- STAGE_UI_05_COMMERCIAL_LAYER

Validation:

- Expired subscription gates content
- Invoices transition correctly
- No commercial data in master_db

Deliverable:
Workspace monetization layer stable.

---

# STEP 9 — MEDIA LIBRARY

Backend:

- Media storage abstraction
- Folder structure
- Tagging
- Usage tracking

UI:

- STAGE_UI_06_MEDIA_LIBRARY

Validation:

- Cannot delete referenced media
- File size limits enforced
- Storage abstraction future-proof

Deliverable:
Media system stable and safe.

---

# STEP 10 — COMMUNICATION LAYER

Backend:

- Notifications engine
- Feedback system
- System feedback isolation

UI:

- STAGE_UI_07_COMMUNICATION

Validation:

- Real-time delivery stable
- No cross-tenant broadcast
- Error handling safe

Deliverable:
Communication engine operational.

---

# STEP 11 — ADS MODULE

Backend:

- Ad CRUD
- Targeting rules
- Placement config

UI:

- Integrated in dashboard and modules

Validation:

- Targeting enforced server-side
- Expired ads never shown

Deliverable:
Ads module isolated and secure.

---

# STEP 12 — BACKOFFICE DASHBOARD

Backend:

- Aggregated metrics
- Subscription metrics
- Student/staff counts

UI:

- STAGE_UI_08_BACKOFFICE_DASHBOARD

Validation:

- Metrics derived from tenant DB only
- Permission enforced
- No cross-tenant aggregation

Deliverable:
Dashboard stable and performant.

---

# STEP 13 — FULL SYSTEM VALIDATION

Execute:

- STAGE_TEST_01_BACKOFFICE_SYSTEM_VALIDATION

Must Validate:

- API contract compliance
- RBAC enforcement
- License enforcement
- Isolation testing
- E2E full user flow
- Load sanity test
- Logging integrity
- Error handling
- Rollback simulation

Phase 3 CANNOT CLOSE unless:

- All E2E tests pass
- No isolation breach detected
- No console/runtime errors
- Backend & UI fully aligned
- No orphan routes

---

# PHASE 3 COMPLETE WHEN:

- All backend stages marked BACKEND_CLOSED
- All UI stages marked UI_READY
- Validation stage passed
- No security violations
- No performance red flags
- No drift between backend and UI

---

Phase 3 builds tenant-level structural integrity.  
No runtime engines should be built before this phase is fully stable.
