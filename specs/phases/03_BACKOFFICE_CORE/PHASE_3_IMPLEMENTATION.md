# PHASE 3 – IMPLEMENTATION PLAN

Phase: 03_BACKOFFICE_CORE  
Objective: Build tenant-level backoffice safely and deterministically

---

Execution Philosophy

Phase 3 must follow strict sequencing.

Backoffice structure must be stable before introducing heavy engines (exam engine, attempt engine, grading runtime).

No feature in this phase may violate:

- Database-per-tenant isolation
- License middleware enforcement
- Schema version enforcement
- Strict RBAC boundaries

If any foundational layer fails validation, implementation must stop and be corrected before proceeding.

---

Step 1 – Tenant Bootstrap

Implement:

- Workspace base layout (shell only)
- Tenant resolver validation hook
- License middleware enforcement
- Module visibility injection based on product
- Base RBAC skeleton (roles + permissions structure)

Validation:

- Tenant resolved correctly on every request
- License status enforced (ACTIVE / SOFT_LOCKED / ARCHIVED)
- Disabled modules hidden at API level (not UI only)
- No master_db access from tenant routes

Stop if isolation fails.

---

Step 2 – Workspace Settings

Implement:

- General settings
- Language settings
- Timezone settings
- Visual identity (logo, favicon, theme tokens)
- Payment settings placeholder (no gateway logic yet)

Validation:

- Settings persisted only in tenant DB
- Language fallback works correctly
- Theme configuration stored as controlled tokens
- No cross-tenant leakage

---

Step 3 – Translation System

Implement:

- translations table
- entity_id + entity_type linking
- Language coverage tracking
- Default language fallback
- Translation management UI

Validation:

- Entity renders fallback if translation missing
- Coverage percentage accurate
- Query performance acceptable for large datasets
- Translation never breaks entity integrity

---

Step 4 – Status Workflow Engine

Implement reusable workflow engine:

- Generic state machine
- Transition validation
- Role-based transition enforcement
- Audit logging of state changes

Validation:

- Illegal transitions blocked
- Unauthorized roles cannot transition
- Workflow reusable across entities
- Status always consistent in DB

---

Step 5 – Academic Structure

Implement in strict order:

1. Divisions
2. Departments
3. Groups
4. Hierarchy (staff tree)
5. Teams
6. Semesters
7. Subjects

Validation:

- Student belongs to exactly one division
- Staff may belong to multiple divisions
- Access restricted by division rules
- No circular hierarchy allowed
- Division disable logic respects default division contract

---

Step 6 – Classification Layer

Implement:

- Categories
- Category values
- Tags
- Basket model (for MCQ auto-selection)

Validation:

- Category values linked correctly
- Filtering works by division and subject
- Query performance acceptable
- No redundant classification joins

---

Step 7 – User Management

Implement:

- Staff management
- Student management
- Role assignment
- Division assignment
- Limit enforcement (student & staff)

Validation:

- Student limit enforced transactionally
- Staff limit enforced transactionally
- Disabled user blocked at middleware
- RBAC enforced at API level
- No race condition in limit counting

---

Step 8 – Commercial Layer

Implement:

- Plans (workspace-level)
- Subscriptions
- Promocodes
- Invoices
- Manual payment recording

Validation:

- Subscription expiration restricts content
- Login allowed but content gated when expired
- Invoice state transitions consistent
- No commercial data stored in master_db

---

Step 9 – Media Library

Implement:

- Media storage abstraction
- Folder structure
- Tagging
- Usage reference tracking

Validation:

- Cannot delete referenced media
- Large file uploads handled safely
- Metadata integrity preserved
- Storage abstraction ready for future external provider

---

Step 10 – Communication Layer

Implement:

- Notifications engine (WebSocket + persistence)
- Feedback system
- System feedback (isolated per workspace)

Validation:

- Real-time delivery stable
- Delivery failure handled safely
- Feedback tied to workspace only
- No cross-tenant broadcast possible

---

Step 11 – Ads Module

Implement:

- Ad CRUD
- Placement configuration
- Division targeting
- Enable / disable per workspace

Validation:

- Ad visible only to target users
- Expired ad never shown
- Target filtering server-side only
- No master_db references

---

Step 12 – Backoffice Dashboard

Implement:

- Student count
- Staff count
- Placeholder metrics for exams
- Subscription metrics

Validation:

- All metrics derived from tenant DB
- Permission enforced
- Query performance acceptable
- No cross-tenant aggregation

---

Phase 3 Completion Criteria

Move to Phase 4 only if:

- Tenant isolation verified
- License middleware enforced everywhere
- RBAC fully enforced
- Translation stable
- Academic structure stable
- Limit enforcement race-condition safe
- Media storage stable
- Workflow engine reusable
- No master_db leakage from tenant runtime

Phase 3 builds structural integrity.  
Phase 4 builds runtime engines.
