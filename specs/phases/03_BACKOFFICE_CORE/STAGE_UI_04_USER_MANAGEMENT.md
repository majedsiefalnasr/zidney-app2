# STAGE_UI_04_USER_MANAGEMENT

Phase: 03_BACKOFFICE_CORE  
Track: UI (apps/backoffice)

Dependencies:

- STAGE_UI_01_BACKOFFICE_SHELL
- STAGE_UI_02_ACADEMIC_STRUCTURE
- STAGE_41_STAFF_MANAGEMENT
- STAGE_42_STUDENT_MANAGEMENT
- STAGE_43_LIMIT_ENFORCEMENT
- STAGE_21_ROLE_PERMISSION_SYSTEM

---

## Purpose

This stage implements the Backoffice UI for:

- Staff management
- Student management
- Role & permission assignment
- License-based limit visibility
- Account status control

UI must strictly consume backend APIs.

No limit logic, permission logic, or role evaluation may be implemented client-side.

---

## Architectural Constraints

User Management UI must:

- Be tenant-scoped only
- Never access master database
- Use centralized API client (Phase 06)
- Respect RBAC middleware responses
- Never assume permission based on UI state
- Never calculate limit counters locally

Backend remains authoritative for:

- User creation validation
- Role assignments
- Permission matrix enforcement
- License limit enforcement
- Status transitions (ACTIVE / LOCKED / ARCHIVED)

---

## Module Breakdown

### 1️⃣ Staff Management

UI must support:

- Create staff
- Edit staff
- Assign roles
- Activate / deactivate
- Reset password (trigger backend flow)
- View audit info

Required fields (example):

- Name
- Email
- Department (if applicable)
- Role
- Status

UI must:

- Prevent duplicate email entry (server validated)
- Map validation errors to fields
- Display last login (read-only)

No password visible in UI.

---

### 2️⃣ Student Management

UI must support:

- Create student
- Bulk import (CSV if backend supports)
- Assign group
- Assign department
- Activate / deactivate
- View enrollment info

Bulk import rules:

- Must validate file client-side (format only)
- Server validates content
- UI displays row-level error mapping

No limit calculation client-side.

If limit exceeded:

- Show backend error message
- Do not retry automatically

---

### 3️⃣ Role & Permission Management (UI Integration)

UI must allow:

- Assign role to user
- View permissions (read-only matrix)
- Modify permissions only if allowed by backend

Permission matrix must:

- Be fetched from backend
- Never hardcoded
- Reflect updates immediately

UI must not cache permission decisions across sessions.

---

### 4️⃣ License Limit Visibility

UI must display:

- Total staff limit
- Used staff count
- Total student limit
- Used student count
- Warning indicator when near threshold

Important:

UI must treat these values as informational only.

Limit enforcement must remain backend-controlled.

If backend returns 409 LIMIT_EXCEEDED:

- Show clear blocking message
- Offer upgrade link (if commercial module enabled)

---

### 5️⃣ Status & Lock Handling

User states (example):

- ACTIVE
- INACTIVE
- LOCKED
- ARCHIVED

UI must:

- Show status badge
- Prevent illegal transitions
- Respect backend state machine

If backend rejects state transition:

- Show conflict message
- Refresh entity state

---

## Concurrency & Conflict Handling

If concurrent update occurs:

- Backend returns 409
- UI must reload user entity
- Display conflict notice

No optimistic concurrency without backend versioning support.

---

## Validation Rules

Client-side:

- Required fields
- Email format
- Password strength (if applicable)
- CSV format validation (bulk import)

Server-side:

- Duplicate email
- Limit exceeded
- Role validation
- Permission enforcement

UI must never bypass server validation.

---

## Security Requirements

Must prevent:

- Role escalation via UI manipulation
- Hidden button bypass via direct API call
- Sensitive data exposure (password, tokens)
- CSV injection attacks (Excel formula injection)

All CSV exports must sanitize leading =, +, -, @.

---

## Observability Requirements

UI must log (structured via client logger):

- user_create_attempt
- user_create_success
- user_create_failure
- role_update
- bulk_import_start
- bulk_import_complete

Must include:

- workspace_slug
- user_id (if applicable)
- correlation_id

No sensitive fields logged.

---

## Performance Considerations

User lists may be large.

UI must:

- Use server-side pagination
- Use filtering (role, status, department)
- Avoid loading all users
- Lazy-load role matrix if heavy

Page load must remain performant.

---

## E2E Validation Scenarios

Mandatory tests:

1. Create staff within limit
2. Exceed staff limit → blocked
3. Assign role successfully
4. Attempt unauthorized role change
5. Bulk import valid CSV
6. Bulk import invalid CSV
7. Lock user
8. Attempt illegal status change
9. Concurrent update simulation
10. RBAC visibility enforcement

All must pass before stage closure.

---

## Completion Criteria

Stage is complete when:

- Staff fully manageable
- Students fully manageable
- Role assignments functional
- License limit visibility accurate
- RBAC enforced
- No client-side permission logic
- No console errors
- E2E tests passing

---

## Governance Rule

Backoffice UI must never become the source of truth for:

- Permission matrix
- License limit logic
- Role enforcement
- Status transitions

All authority remains in backend domain core.

---
