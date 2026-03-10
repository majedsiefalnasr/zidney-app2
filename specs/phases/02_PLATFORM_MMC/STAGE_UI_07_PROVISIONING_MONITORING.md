# STAGE_UI_07_PROVISIONING_MONITORING

## Stage Type

Platform MMC — UI Feature Stage (Provisioning Monitoring & Operational Control UI)

Depends On:

- Phase 06 UI Application Runtime
- STAGE_UI_01_MMC_SHELL_INTEGRATION
- STAGE_UI_02_API_CLIENT_LAYER
- STAGE_UI_04_GLOBAL_ERROR_HANDLING
- STAGE_UI_05_MMC_DASHBOARD
- STAGE_12_PROVISIONING_TRIGGER (Backend)
- STAGE_11_LICENSE_LIFECYCLE (Backend)
- STAGE_16_SHARED_UI_SYSTEM

---

## Stage Status

Status: DRAFT

---

## Purpose

Implement the MMC Provisioning Monitoring interface.

This stage provides operational visibility and limited control over:

- License provisioning jobs
- Provisioning failures
- Retry actions (if backend allows)
- Snapshot status (if applicable)
- Provisioning queue health

This UI is strictly operational. It does NOT execute provisioning logic directly.

All provisioning state is backend-authoritative.

---

## Functional Scope

The Provisioning Monitoring UI must support:

1. List provisioning jobs (paginated)
2. Filter by:
   - Status (IN_PROGRESS, COMPLETED, FAILED)
   - License ID
   - Workspace slug
   - Date range
3. View provisioning job details
4. View failure reason (if failed)
5. Retry provisioning (if backend supports retry endpoint)
6. View snapshot creation status (if part of lifecycle)
7. View job duration and timestamps
8. Display queue health summary

No manual DB operations. No forced provisioning state changes. No direct tenant DB inspection.

---

## Routing

Routes:

```
/provisioning
/provisioning/:jobId
```

Requirements:

- Protected by MMC auth guard
- Rendered inside AppLayout
- No tenant resolution in UI
- No JWT decoding for privilege branching
- Backend enforces authorization

Router file:

```
core/router/mmc.routes.ts
```

---

## Module Structure

```
modules/provisioning/
 ├── components/
 │   ├── ProvisioningTable.vue
 │   ├── ProvisioningStatusBadge.vue
 │   ├── ProvisioningDetailPanel.vue
 │   ├── ProvisioningRetryButton.vue
 │   ├── ProvisioningQueueHealth.vue
 │   └── ProvisioningFilters.vue
 ├── provisioning.store.ts
 ├── provisioning.api.ts
 ├── types.ts
```

No provisioning logic outside this module.

---

## API Integration

All HTTP must go through:

```
core/api/client
```

provisioning.api.ts must define:

- getProvisioningJobs(params)
- getProvisioningJobById(jobId)
- retryProvisioning(jobId) (if allowed)
- getQueueHealth()

No direct axios/fetch usage in components.

---

## State Management

provisioning.store.ts must manage:

State:

- jobs
- pagination
- filters
- selectedJob
- queueHealth
- loading
- error

Actions:

- fetchJobs
- fetchJobById
- retryJob
- fetchQueueHealth

Behavior:

- Normalize API errors
- Use notification store for success/failure
- Do not simulate job transitions locally
- Do not cache job state beyond session

---

## Provisioning Table

Must use shared DataTable.

Columns:

- Job ID
- Workspace slug
- License ID
- Status
- Started at
- Completed at
- Duration

Row actions:

- View details
- Retry (if FAILED and allowed)

UI must not:

- Allow retry if backend does not permit
- Assume job success before backend confirmation

---

## Provisioning Detail Panel

Must display:

- Job metadata
- Full lifecycle timeline
- Snapshot status (if applicable)
- Failure reason (if FAILED)
- Retry eligibility

Detail panel must:

- Handle polling if job IN_PROGRESS
- Stop polling on completion
- Cancel polling on unmount

No global polling.

---

## Retry Behavior

If backend exposes retry endpoint:

- Retry must require confirmation modal
- UI must disable button during retry
- UI must handle 409 conflict
- UI must handle 423 locked
- UI must handle 500 error

If retry not allowed:

- Button must not render

UI must never attempt duplicate retries without backend confirmation.

---

## Queue Health Panel

Display:

- Total jobs in queue
- In-progress count
- Failure rate (if backend provides)
- Worker availability indicator (if backend provides)

No local computation of queue metrics unless raw counts provided.

---

## Security Requirements

UI must:

- Not expose internal worker IDs
- Not expose raw infrastructure logs
- Not display sensitive error payloads
- Not log provisioning tokens
- Not allow job ID tampering
- Not override backend retry policy

HTTP handling:

401 → redirect login  
403 → permission denied  
409 → conflict  
423 → locked  
500 → global error handler

---

## Testing Requirements

Unit tests:

- Store fetch jobs test
- Retry action test
- Polling behavior test
- Queue health render test
- Error normalization test

Manual validation:

- View provisioning jobs
- Filter by status
- Open detail panel
- Retry failed job (if allowed)
- Simulate conflict error
- Hard refresh job detail route

---

## Explicit Non-Goals

This stage does NOT:

- Trigger provisioning manually outside retry endpoint
- Modify tenant databases
- Edit job metadata
- Access infrastructure logs
- Implement worker scaling logic
- Provide DevOps dashboards

Operational visibility only.

---

## Completion Criteria

Stage complete when:

- /provisioning route functional
- Jobs list loads correctly
- Filters work
- Detail panel works
- Retry action works (if supported)
- Queue health panel renders
- No direct HTTP in components
- No TypeScript errors
- No ESLint errors
- Unit tests passing
- Manual smoke test completed

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
