# PHASE 3 – Backoffice Core

Version: 1.0
Status: Authoritative
Scope: Tenant-Level Academic and Administrative Control Panel

---

## Objective

Build the Backoffice (Workspace) system that allows each licensed institution to:

- Configure academic structure
- Manage staff and students
- Create and manage content
- Configure exam engines
- Manage subscriptions and billing (tenant-level)
- Manage media, notifications, ads, and feedback

Backoffice operates strictly inside tenant databases.

Backoffice must never access master_db directly.

---

## Architectural Position

Backoffice is the institutional control panel.

It operates only after:

- Tenant provisioning is complete
- License status is ACTIVE
- Schema version validated
- Tenant resolver attached

Every Backoffice request must pass through:

- Tenant Resolver Middleware
- License Validation Middleware
- Schema Version Enforcement
- RBAC Enforcement

Backoffice must not:

- Mutate license lifecycle
- Trigger provisioning directly
- Modify product definitions
- Access other tenants

---

## Subdomains

Backoffice Core is divided into structured subdomains:

Foundation

- Tenant bootstrap
- Workspace settings
- Translation system
- Status workflow engine
- Role and permission system

Academic Structure

- Divisions
- Departments
- Groups
- Hierarchy tree (staff organization)
- Teams
- Semesters
- Subjects
- Lessons

Content Classification

- Categories
- Category values
- Tags
- MCQ baskets

Exam Engine Core

- MCQ question model
- Traditional question model
- MCQ exam configuration
- Traditional exam configuration
- Scheduled engine
- Auto-selection engine
- Grading core

User Management

- Staff management
- Student management
- Limit enforcement

Commercial Layer

- Plans and subscriptions
- Promocodes
- Billing and invoices

Assets and Communication

- Media library
- Notifications engine
- Feedback system
- System feedback
- Ads engine

Dashboard

- Backoffice metrics and insights

Each subdomain has strict boundaries and must not leak into others.

---

## Data Isolation Rules

Backoffice must operate strictly within its tenant database.

Forbidden:

- Cross-tenant queries
- Shared student tables
- Shared attempt tables
- Cross-database joins
- Accessing master tables

All operations must use tenantDb from request context.

---

## Division Model

Division is shared between students and staff.

Student rules:

- Must belong to exactly one division
- Cannot belong to multiple divisions

Staff rules:

- May belong to multiple divisions

If divisions feature is disabled:

- System must enforce a default division
- All data must map to default division
- Disabling divisions requires irreversible confirmation

---

## Permission Model

Backoffice uses strict RBAC.

Permissions must:

- Be enforced at API layer
- Never rely on frontend validation
- Apply globally within tenant
- Not vary per division in Phase 3

Role resolution must happen per request.

---

## Status Workflow Engine

Entities supporting status flow must follow:

Completed → Under Review → Approved → Enabled

Transitions must:

- Be permission-controlled
- Be validated server-side
- Be auditable

Hardcoded flows are allowed in Phase 3.

---

## Subscription Enforcement

Backoffice must enforce:

- Student limit
- Staff limit
- Plan restrictions

Limit checks must be transactional.

Subscription expiration must:

- Block frontoffice content access
- Allow login
- Allow certificate viewing

---

## Observability

All Backoffice actions must:

- Include workspace_slug in logs
- Include request_id
- Include user_id
- Emit structured logs

Sensitive actions must create audit records.

---

## Stability Constraints

Backoffice must remain:

- Deterministic
- Schema-version compatible
- Transaction-safe
- Isolation-safe

No feature may bypass:

- Tenant resolver
- License enforcement
- Schema enforcement
- RBAC validation

---

## Completion Criteria

Phase 3 is complete when:

- Academic structure stable
- Content classification stable
- Exam configuration stable
- User management stable
- Subscription enforcement stable
- Media and notification systems functional
- Ads system functional
- Dashboard operational
- No cross-tenant leakage exists

---

Next Phase:
04_RUNTIME
