# API Contract: Workflow Transition Endpoint

**Stage**: STAGE_20_STATUS_WORKFLOW_ENGINE  
**Branch**: `020-status-workflow-engine`  
**Date**: 2026-03-01

---

## Endpoint

```
POST /api/backoffice/:workspaceSlug/workflow/:entityType/:entityId/transition
```

---

## Middleware Stack (applied in order before handler)

1. **Tenant Resolver** — resolves `:workspaceSlug` to tenant DB connection; sets `c.get('tenantDb')`
2. **License Validation** — validates workspace license status; returns `423` (SOFT_LOCKED), `403` (ARCHIVED), `404` (NOT FOUND)
3. **Authentication** — validates JWT; sets `actorId` and `permissions[]` in request context; returns `401` on failure
4. **Rate Limiting** — key: `workflow-transition:{actorId}:{entityType}`; limit: 20/minute; returns `429` on breach

---

## Path Parameters

| Parameter       | Type   | Required | Description                                                                                                                            |
| --------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `workspaceSlug` | string | ✅       | Tenant workspace slug (resolves to tenant DB)                                                                                          |
| `entityType`    | string | ✅       | Entity type identifier. Allowed values: `subject`, `mcq_question`, `traditional_question`, `exam`, `topic`, `library_file`, `template` |
| `entityId`      | UUID   | ✅       | UUID of the target entity                                                                                                              |

---

## Request Body

```json
{
  "target_state": "UNDER_REVIEW",
  "reason": "Optional justification string"
}
```

| Field          | Type                                                       | Required      | Validation                                                                                             |
| -------------- | ---------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `target_state` | `"COMPLETED" \| "UNDER_REVIEW" \| "APPROVED" \| "ENABLED"` | ✅            | Must be a valid `WorkflowState` value                                                                  |
| `reason`       | string                                                     | ❌ (nullable) | Required when performing a backward transition; optional for forward transitions; stored when provided |

---

## Responses

### 200 OK — Transition Successful

```json
{
  "success": true,
  "data": {
    "entityType": "subject",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "previousState": "COMPLETED",
    "newState": "UNDER_REVIEW",
    "changedBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "changedAt": "2026-03-01T10:30:00.000Z",
    "logId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  },
  "error": null
}
```

### 400 Bad Request — Invalid State Transition

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "invalid_state_transition",
    "message": "Cannot transition subject from COMPLETED to APPROVED (must go through UNDER_REVIEW)",
    "details": null,
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 400 Bad Request — Justification Required

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "justification_required",
    "message": "A non-empty reason is required for backward transitions",
    "details": null,
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 400 Bad Request — Unknown Entity Type

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "unknown_entity_type",
    "message": "Entity type 'custom_thing' is not registered with the workflow engine",
    "details": null,
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 403 Forbidden — Permission Denied

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "workflow_permission_denied",
    "message": "Actor does not hold permission 'subject.review' required for this transition",
    "details": null,
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 404 Not Found — Entity Not Found

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "entity_not_found",
    "message": "Subject with id '550e8400-...' not found in this workspace",
    "details": null,
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 409 Conflict — Concurrent Transition

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "workflow_conflict",
    "message": "A concurrent transition modified this entity. Please retry after fetching the current state.",
    "details": null,
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 429 Too Many Requests — Rate Limit Exceeded

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Transition rate limit exceeded: 20 transitions per user per entity-type per minute",
    "details": null,
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Headers

### Request Headers

| Header             | Required | Description                                    |
| ------------------ | -------- | ---------------------------------------------- |
| `Authorization`    | ✅       | `Bearer <jwt_token>`                           |
| `Content-Type`     | ✅       | `application/json`                             |
| `x-correlation-id` | ❌       | Propagated correlation ID; generated if absent |

### Response Headers

| Header             | Value                              |
| ------------------ | ---------------------------------- |
| `Content-Type`     | `application/json`                 |
| `x-correlation-id` | Echoed or generated correlation ID |

---

## Permission Identifier Convention

The route handler resolves the actor's permissions from the JWT/RBAC context and passes them as `permissions: string[]` in `WorkflowContext`. The engine constructs the required permission identifier as:

```
{entity_type}.{action_key}
```

| entity_type                             | action_key | Permission        | Transition                 |
| --------------------------------------- | ---------- | ----------------- | -------------------------- |
| `subject`                               | `review`   | `subject.review`  | `COMPLETED → UNDER_REVIEW` |
| `subject`                               | `approve`  | `subject.approve` | `UNDER_REVIEW → APPROVED`  |
| `subject`                               | `enable`   | `subject.enable`  | `APPROVED → ENABLED`       |
| `subject`                               | `return`   | `subject.return`  | Any backward               |
| _(same pattern for all 7 entity types)_ |            |                   |                            |

---

## Idempotency Behaviour

- If the entity is **already** in `target_state`: returns `400 invalid_state_transition` (FR-017).
- If the exact same request is submitted twice simultaneously: `SELECT FOR UPDATE` serialises the two requests; the second observes the post-commit state and returns `400 invalid_state_transition`.
- There is **no silent success** on duplicate calls — every call attempts a genuine transition.

---

## Audit Trail

Every successful `200` response guarantees:

1. One row inserted in `workflow_logs` with all fields populated.
2. Entity row updated with `status`, `status_updated_at`, `status_updated_by`.
3. Both writes in the same transaction — no partial state possible.
