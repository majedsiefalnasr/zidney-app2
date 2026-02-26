# STAGE_UI_04_LICENSES

## Stage Type

Platform MMC — UI Feature Stage (Licenses Management UI)

Depends On:

- Phase 06 UI Application Runtime
- STAGE_UI_01_MMC_SHELL_INTEGRATION
- STAGE_UI_02_API_CLIENT_LAYER
- STAGE_10_LICENSES (Backend)
- STAGE_11_LICENSE_LIFECYCLE (Backend)
- STAGE_12_PROVISIONING_TRIGGER (Backend)
- STAGE_16_SHARED_UI_SYSTEM

---

## Stage Status

Status: DRAFT

---

## Purpose

Implement the complete MMC Licenses Management user interface.

This stage provides the operational UI for:

- Creating licenses
- Viewing license details
- Managing license lifecycle (soft-lock, archive, restore, delete)
- Viewing provisioning status
- Observing schema/product version compatibility
- Viewing audit trail (read-only)

This stage strictly consumes backend APIs.
No business logic is implemented in the UI.

---

## Functional Scope

The UI must support:

1. License listing (paginated)
2. Filtering by status:
   - ACTIVE
   - SOFT_LOCKED
   - ARCHIVED
   - DELETED (if visible)
3. Create license
4. View license detail
5. Soft-lock license
6. Archive license
7. Restore license
8. Delete license (if allowed)
9. View provisioning status
10. View lifecycle audit log
11. Display version mismatch warnings (schema/product)

---

## Routing

Routes:

```
/licenses
/licenses/create
/licenses/:id
/licenses/:id/audit
```

Must:

- Be protected by MMC auth guard
- Render inside AppLayout
- Use route-based lazy loading
- Not decode JWT for role enforcement
- Not resolve tenant manually

Router file:

```
core/router/mmc.routes.ts
```

---

## Module Structure

Inside MMC:

```
modules/licenses/
 ├── components/
 │   ├── LicensesTable.vue
 │   ├── LicenseForm.vue
 │   ├── LicenseStatusBadge.vue
 │   ├── LicenseLifecycleActions.vue
 │   ├── LicenseProvisioningStatus.vue
 │   ├── LicenseVersionWarning.vue
 │   └── LicenseAuditTimeline.vue
 ├── licenses.store.ts
 ├── licenses.api.ts
 ├── types.ts
```

No license UI logic outside this module.

---

## API Integration

All HTTP must go through:

```
core/api/client
```

licenses.api.ts must implement:

- getLicenses(params)
- getLicenseById(id)
- createLicense(payload)
- softLockLicense(id)
- archiveLicense(id)
- restoreLicense(id)
- deleteLicense(id)
- getLicenseAuditLog(id)
- getProvisioningStatus(id)

No fetch/axios inside components.

---

## State Management

licenses.store.ts must manage:

State:

- licenses
- pagination
- filters
- selectedLicense
- auditLog
- provisioningStatus
- loading
- error

Actions:

- fetchLicenses
- fetchLicense
- createLicense
- executeLifecycleAction
- fetchAuditLog
- fetchProvisioningStatus

Store must:

- Normalize API errors
- Trigger notification store
- Avoid local lifecycle simulation
- Avoid optimistic mutation without backend confirmation
- Clear sensitive data on logout

---

## License Creation Flow

LicenseForm must include:

- workspace_slug
- product_id
- plan_id (if applicable)
- limits (if configurable)
- optional affiliate reference
- notes

Validation:

- Zod schema-based validation
- Slug format validation
- Prevent duplicate slug submission (disable submit while loading)

On success:

- Redirect to /licenses/:id
- Trigger provisioning polling

On error:

- Display normalized error
- Preserve form state

---

## License Listing Table

Must use shared DataTable.

Columns:

- Workspace slug
- Product
- Status
- Plan
- Created at
- Limits summary

Row actions:

- View
- Soft-lock
- Archive
- Restore
- Delete (if allowed)

No business rules enforced in table.

---

## Lifecycle Actions

Lifecycle buttons must:

- Require confirmation modal
- Handle 409 conflict responses
- Handle 423 locked responses
- Handle 426 version mismatch
- Show backend error messages

UI must not:

- Simulate transitions
- Force status locally
- Allow illegal state transitions

Backend is authoritative.

---

## Provisioning Status Panel

If license is:

- PROVISIONING → show progress indicator
- PROVISION_FAILED → show error state
- ACTIVE → show success indicator

Must poll provisioning endpoint:

- Poll every X seconds (configurable)
- Stop polling when final state reached
- Cancel polling on component unmount

No polling in global scope.

---

## Version Warning Display

If backend returns:

- SCHEMA_VERSION_MISMATCH
- VERSION_INCOMPATIBLE

UI must:

- Display warning banner
- Disable lifecycle actions if required
- Not override backend restriction

---

## Audit Timeline

LicenseAuditTimeline must:

- Display append-only events
- Show timestamp
- Show action
- Show actor
- Show metadata summary

No editing.
No deletion.
Read-only display.

---

## Security Requirements

UI must:

- Never log tokens
- Never log workspace secrets
- Never expose audit raw payload
- Not allow manual workspace ID manipulation
- Not trust client time
- Not bypass lifecycle middleware

401 → redirect login  
403 → permission denied  
409 → conflict  
423 → soft-locked  
426 → upgrade required

---

## Testing Requirements

Must include:

Unit tests:

- Store lifecycle action test
- Conflict handling test
- Version warning rendering
- Provisioning polling behavior
- Audit timeline render

Manual validation:

- Create license
- Trigger provisioning
- Soft-lock active license
- Archive soft-locked license
- Restore archived license
- Attempt illegal transition (verify error)
- View audit timeline
- Hard refresh license detail page

---

## Explicit Non-Goals

This stage does NOT:

- Modify license limits directly
- Execute provisioning logic
- Modify backend lifecycle rules
- Perform tenant DB operations
- Manage billing/payment
- Implement analytics dashboards

UI layer only.

---

## Completion Criteria

Stage complete when:

- /licenses route functional
- License creation works
- Lifecycle actions functional
- Provisioning polling works
- Audit log displays correctly
- Version warnings render correctly
- No direct HTTP in components
- No TypeScript errors
- No ESLint errors
- All unit tests passing
- Manual smoke test completed

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
