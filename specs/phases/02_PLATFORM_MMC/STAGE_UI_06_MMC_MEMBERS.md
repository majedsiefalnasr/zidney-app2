# STAGE_UI_06_MMC_MEMBERS

## Stage Type

Platform MMC — UI Feature Stage (MMC Members & Admin Management UI)

Depends On:

- Phase 06 UI Application Runtime
- STAGE_UI_01_MMC_SHELL_INTEGRATION
- STAGE_UI_02_API_CLIENT_LAYER
- STAGE_UI_06_STATE_MANAGEMENT
- STAGE_14_MMC_MEMBERS (Backend)
- STAGE_16_SHARED_UI_SYSTEM

---

# 🎯 Purpose

Implement the MMC Members Management user interface.

This stage enables management of:

- MMC administrators
- Roles (if supported by backend)
- Member activation / deactivation
- Role assignment
- Member audit visibility (read-only)

This stage does NOT implement authentication logic.
It consumes backend APIs defined in STAGE_14_MMC_MEMBERS.

---

# 🧱 Functional Scope

The MMC Members UI must support:

1. List members (paginated)
2. Filter by role
3. Filter by status (ACTIVE / INACTIVE)
4. Search by name or email
5. Create new member (admin invite flow)
6. Edit member role
7. Activate / deactivate member
8. View member activity summary (if backend provides)
9. View member audit log (read-only)

No password management UI here (handled in auth module).
No token management UI.

---

# 🧭 Routing

Routes:

```
/members
/members/create
/members/:id
/members/:id/edit
```

Requirements:

- Protected by MMC auth guard
- Rendered inside AppLayout
- No JWT decoding in UI
- No permission branching in UI logic
- Rely on backend 403 enforcement

Router file:

```
core/router/mmc.routes.ts
```

---

# 🗂 Module Structure

```
modules/members/
 ├── components/
 │   ├── MembersTable.vue
 │   ├── MemberForm.vue
 │   ├── MemberStatusBadge.vue
 │   ├── MemberRoleSelector.vue
 │   ├── MemberAuditTimeline.vue
 │   └── MemberFilters.vue
 ├── members.store.ts
 ├── members.api.ts
 ├── types.ts
```

No member logic outside this module.

---

# 📡 API Integration

All API calls must use:

```
core/api/client
```

members.api.ts must implement:

- getMembers(params)
- getMemberById(id)
- createMember(payload)
- updateMemberRole(id, role)
- toggleMemberStatus(id)
- getMemberAuditLog(id)

No fetch/axios inside components.

---

# 🔄 State Management

members.store.ts must manage:

State:

- members
- pagination
- filters
- selectedMember
- auditLog
- loading
- error

Actions:

- fetchMembers
- fetchMember
- createMember
- updateRole
- toggleStatus
- fetchAuditLog

Store rules:

- Normalize API errors
- Use notification store for success/error
- No local RBAC simulation
- No storing sensitive data
- Clear state on logout

---

# 🧾 Member Creation Flow

MemberForm fields:

- name
- email
- role
- status (optional, default ACTIVE)

Behavior:

- On create → backend triggers invite flow
- UI does NOT send password
- UI does NOT generate credentials

Validation:

- Zod-based validation
- Email format validation
- Role must match backend-defined enum
- Prevent duplicate submissions

On success:

- Redirect to /members
- Show success notification

On error:

- Display normalized error
- Preserve form state

---

# 📊 Members Table

Must use shared DataTable.

Columns:

- Name
- Email
- Role
- Status
- Created At

Row actions:

- View
- Edit role
- Activate / Deactivate

No business logic in table.

No client-side permission enforcement.

---

# 🟢 Role Management

MemberRoleSelector:

- Must use backend-defined roles
- Role list fetched from backend if dynamic
- If static, must match backend enum exactly

UI must:

- Confirm role changes
- Handle 409 conflict
- Handle 403 unauthorized

No role hierarchy logic in UI.

---

# 🧾 Member Audit Timeline

If backend supports audit:

Display:

- Role changes
- Status changes
- Account creation
- Invite sent
- Login events (if provided)

Read-only.

No editing.
No deletion.

---

# 🔐 Security Requirements

UI must:

- Not expose JWT payload
- Not log tokens
- Not expose audit raw metadata
- Not allow role tampering via client manipulation
- Not trust client time

HTTP responses:

401 → redirect login  
403 → permission denied  
409 → conflict  
500 → global error handler

---

# 🧪 Testing Requirements

Unit tests:

- Store fetch test
- Role update test
- Status toggle test
- Form validation test
- Audit timeline render test

Manual validation:

- Create member
- Edit role
- Activate / deactivate member
- Attempt unauthorized role change (verify 403 handling)
- Hard refresh member detail page

---

# 🚫 Explicit Non-Goals

This stage does NOT:

- Implement login UI
- Implement password reset UI
- Implement MFA management
- Implement token revocation
- Implement permission matrix editor
- Implement cross-workspace member management

MMC members only.

---

# 🏁 Completion Criteria

Stage complete when:

- /members route functional
- Create member works
- Role update works
- Status toggle works
- Audit log renders
- No direct HTTP in components
- No TypeScript errors
- No ESLint errors
- Unit tests passing
- Manual smoke test completed

---

# Status

## Stage Status

DRAFT – Implementation not started
