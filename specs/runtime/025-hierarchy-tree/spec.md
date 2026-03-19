# Feature Specification: Hierarchy Tree

**Feature Branch**: `spec/025-hierarchy-tree`  
**Stage**: `STAGE_25_HIERARCHY_TREE`  
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`  
**Created**: 2026-03-19  
**Status**: DRAFT  
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_25_HIERARCHY_TREE.md`

---

## Feature Overview

This stage implements a **staff-only organizational hierarchy tree** for Zidney workspaces. The
hierarchy is a self-referencing, unlimited-depth tree of named nodes used to model reporting
structure, organizational chart representation, and managerial segmentation. It is a purely
organizational construct — it does NOT control academic visibility, exam filtering, division-based
access rules, or student assignment.

**What is being built:**

- A `hierarchy_nodes` table per-tenant: unlimited-depth self-referencing tree with cycle
  detection, parent-restricted deletion, and unique name constraint per parent scope.
- CRUD API endpoints (create, read, update, delete) for hierarchy nodes, all protected by tenant
  resolver → license middleware.
- Tree traversal endpoints: full tree (nested), flat list with depth indicators, and subtree from
  a specific root node.
- Reparenting support: changing a node's `parent_id` with cycle-detection validation before commit.
- Status toggle (`ENABLED` | `DISABLED`) with blocking rules for disabled-node assignment.
- Referential integrity enforced at DB layer: parent deletion blocked when children exist;
  `ON DELETE RESTRICT` on `parent_id`.

**Scope boundary — Staff Assignment Interface Contract:**  
Staff assignment to hierarchy nodes (`hierarchy_node_id` on `users` table) is the responsibility
of a downstream stage (STAGE_26 or equivalent staff management stage). This specification defines
the hierarchy tree structure and the assignment contract that the downstream stage must satisfy:

- Each staff member must belong to exactly one `ENABLED` hierarchy node after bootstrap.
- The `hierarchy_nodes` table and its CRUD/traversal API must be stable before staff assignment is
  activated.
- The downstream stage must add `hierarchy_node_id` (UUID, nullable, FK → `hierarchy_nodes.id`,
  `ON DELETE RESTRICT`) to the `users` table within its own migration.

**Primary use cases:**

| Use Case                | How Hierarchy Is Applied                                        |
| ----------------------- | --------------------------------------------------------------- |
| Reporting structure     | Nodes represent reporting units; manager-to-staff traversal     |
| Organizational charts   | Full-tree endpoint feeds org-chart UI rendering                 |
| Managerial segmentation | Subtree endpoint returns all nodes under a given manager node   |
| Internal analytics      | Aggregated statistics rolled up per hierarchy node in analytics |

**Phase & Stage mapping:** Phase 03 Backoffice Core, Academic Structure domain. This stage depends
on the platform foundation (tenant DB provisioning, license middleware, structured logging) but
has no direct dependency on Divisions, Departments, or Groups — the organizational hierarchy tree
is an independent structural entity. This stage must be stable before the downstream staff
assignment stage integrates `hierarchy_node_id` into the `users` table.

**Affected system areas:**

| Area                | Affected? | Notes                                                                              |
| ------------------- | --------- | ---------------------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | `hierarchy_nodes` table resides exclusively in tenant DB; no shared hierarchy data |
| License Enforcement | Yes       | License middleware is mandatory for all workspace hierarchy routes                 |
| Attempt Engine      | No        | Hierarchy does not alter attempt snapshot, timing, or grading in any way           |
| Worker              | No        | All hierarchy CRUD is synchronous; no background job required                      |
| Runtime             | No        | Hierarchy is a Backoffice configuration concept only; no frontoffice exposure      |
| Frontoffice         | No        | Hierarchy is staff-only; no student-facing hierarchy data in this stage            |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ `hierarchy_nodes` table resides exclusively within the tenant DB                              |
| No middleware bypass                   | ✓ Tenant resolver → license middleware are mandatory before any hierarchy route                 |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                               |
| No direct DB instantiation             | ✓ All DB access originates from tenant resolver context; no global singleton                    |
| No weakening of snapshot integrity     | ✓ Feature does not touch attempt snapshots                                                      |
| No weakening of transaction boundaries | ✓ All writes (including cycle detection and deletion guards) execute inside a transaction       |
| No weakening of version enforcement    | ✓ Schema version bump required; migration is forward-only                                       |
| Server-authoritative time only         | ✓ All `created_at` / `updated_at` timestamps are set server-side; no client-supplied timestamps |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                                        |
| Division boundary preserved            | ✓ Hierarchy is organizational only; no interaction with division or department isolation rules  |

No exceptions requiring a new ADR were detected for this stage.

---

## Isolation Impact Analysis

- **Database accessed:** Tenant DB only (resolved per workspace slug / subdomain context).
- **Tenant resolution:** Via existing tenant resolver middleware executed before any route handler.
- **Connection pool:** Obtained from tenant-scoped in-memory connection pool map; no global
  singleton.
- **Resolver middleware:** Mandatory — no route handler may access the DB before tenant and license
  validation.
- **Tables introduced or modified:**
  - `hierarchy_nodes` — new table in tenant DB (self-referencing tree)
  - `users` — `hierarchy_node_id` nullable FK column to be added by the **downstream staff
    assignment stage** (outside the scope of this stage, documented here as an interface contract)

**Confirmed:** No shared tenant data. No cross-tenant joins. No global hierarchy singleton.

---

## License & Version Enforcement

- **License middleware required:** Yes — all Backoffice Hierarchy API routes require an active
  workspace license.
- **Allowed license states:** `ACTIVE` only.
  - `SOFT_LOCKED` → 423 Locked
  - `ARCHIVED` → 403 Forbidden
  - `NOT_FOUND` → 404 Not Found
- **Limit enforcement required:** No global node-count limits in this stage.
- **`schema_version` checked:** Yes — migration increments schema version; runtime rejects
  incompatible tenants.
- **`product_version` checked:** Yes — enforced at request boundary per Constitution.

---

## User Scenarios & Testing

### User Story 1 – Administrator Creates a Root Node (Priority: P1)

A Backoffice administrator creates a top-level hierarchy node with no parent, establishing the root
of an organizational tree.

**Why this priority:** Root nodes are the foundation of every hierarchy tree; no child nodes can
exist without at least one root.

**Independent Test:** Create a node named "Executive" with `parent_id = null`; verify it appears in
the list endpoint with `status = ENABLED`, `parent_id = null`, and a valid `id`.

**Acceptance Scenarios:**

1. **Given** an active workspace license, **When** a staff member with hierarchy management
   permission sends a create request with a unique `name` and `parent_id = null`, **Then** the
   node is persisted with `status = ENABLED`, `parent_id = null`, and all nullable fields set to
   `null`.
2. **Given** a name collision at the root level (another root-level node with the same `name`
   already exists), **When** a second create request uses the same `name` and `parent_id = null`,
   **Then** the API returns 409 Conflict with error code `HIERARCHY_NODE_NAME_DUPLICATE`.
3. **Given** a create request with a missing or empty `name`, **Then** the API returns 422 with
   error code `VALIDATION_ERROR` and a descriptive field-level message.
4. **Given** a staff member without hierarchy management permission, **When** they attempt to
   create a node, **Then** the API returns 403 Forbidden.
5. **Given** a create request where `name` contains only whitespace, **Then** the API returns 422
   with `VALIDATION_ERROR` after server-side trimming detects an empty value.

---

### User Story 2 – Administrator Creates a Child Node (Priority: P1)

A Backoffice administrator creates a child node under an existing parent node, building out the
hierarchy depth.

**Why this priority:** Child node creation is the primary way the hierarchy tree grows and models
organizational structure.

**Independent Test:** Create parent node "Division A"; create child node "Team Alpha" with
`parent_id` set to "Division A"'s id; verify the child appears in the tree endpoint nested under
its parent.

**Acceptance Scenarios:**

1. **Given** an existing parent node with `status = ENABLED`, **When** a child node is created
   with a unique name within that parent's scope, **Then** the child is persisted referencing the
   parent's `id`.
2. **Given** a `parent_id` referencing a non-existent node, **Then** the API returns 422 with
   `HIERARCHY_NODE_PARENT_NOT_FOUND`.
3. **Given** an existing sibling with the same `name` under the same `parent_id`, **When** a
   second child is created with the same `name` and same `parent_id`, **Then** the API returns 409
   with `HIERARCHY_NODE_NAME_DUPLICATE`.
4. **Given** the same `name` used under two different parents, **When** each child is created
   under its respective parent, **Then** both creations succeed — uniqueness is per-parent-scope
   only.
5. **Given** `parent_id = null`, **When** the node is created without a parent, **Then** the API
   persists it as a root node.
6. **Given** an ENABLED parent node, **When** multiple levels of children are created
   (grandchildren, great-grandchildren), **Then** each level is correctly persisted and visible in
   the tree traversal endpoint.

---

### User Story 3 – Administrator Views the Full Hierarchy Tree (Priority: P1)

A Backoffice administrator retrieves the full hierarchy tree in nested format for org-chart
rendering.

**Why this priority:** The tree view is the primary UI surface for organizational hierarchy
management.

**Independent Test:** Create a 3-level hierarchy (root → child → grandchild); call the full-tree
endpoint; verify the nested JSON structure matches the parent-child relationships.

**Acceptance Scenarios:**

1. **Given** a workspace with a populated hierarchy, **When** the full-tree endpoint is called,
   **Then** all nodes are returned as a nested JSON structure where each node contains its `id`,
   `name`, `description`, `status`, and a `children` array.
2. **Given** multiple root nodes exist, **When** the full-tree endpoint is called, **Then** all
   roots are returned as top-level items in the response array.
3. **Given** no hierarchy nodes exist, **Then** the full-tree endpoint returns an empty array.
4. **Given** a filter `status = ENABLED` is applied, **Then** only ENABLED nodes appear in the
   tree; DISABLED nodes and their subtrees are excluded.
5. **Given** a filter `status = DISABLED` is applied, **Then** only DISABLED nodes appear; their
   parent references may point to nodes not included in the result if those parents are ENABLED.

---

### User Story 4 – Administrator Views the Flat List (Priority: P2)

A Backoffice administrator retrieves a flat list of all hierarchy nodes with depth indicators for
tabular display.

**Why this priority:** Tabular list views require flat data with depth metadata for indentation
rendering without building the full nested tree client-side.

**Independent Test:** Seed a 3-level tree; call the flat-list endpoint; verify each item has a
`depth` field (0 for root, 1 for child, 2 for grandchild) and `parent_id` populated correctly.

**Acceptance Scenarios:**

1. **Given** a populated hierarchy, **When** the flat-list endpoint is called, **Then** all nodes
   are returned as a flat array with `id`, `name`, `parent_id`, `description`, `status`,
   `created_at`, `updated_at`, and `depth` fields.
2. **Given** root nodes, **Then** `depth = 0` for root nodes, `depth = 1` for their direct
   children, incrementing by 1 per level.
3. **Given** pagination parameters (`page`, `per_page`), **Then** the list respects pagination and
   returns the correct slice with total count metadata.
4. **Given** a `status` filter, **Then** only nodes matching that status are returned.
5. **Given** no nodes exist, **Then** an empty `items` array and `total = 0` are returned.

---

### User Story 5 – Administrator Retrieves a Subtree (Priority: P2)

A Backoffice administrator retrieves the nested subtree rooted at a specific node.

**Why this priority:** Managers need to view only their portion of the hierarchy without loading
the full organizational tree.

**Independent Test:** Create a 3-level tree; request the subtree rooted at the second-level node;
verify the response contains only that node and its descendants, not siblings or the root.

**Acceptance Scenarios:**

1. **Given** a valid node `id`, **When** the subtree endpoint is called, **Then** the response
   contains the target node and all its descendants in nested format.
2. **Given** a leaf node (no children), **When** the subtree endpoint is called, **Then** the
   response contains only that node with an empty `children` array.
3. **Given** an invalid `id`, **Then** the API returns 404 with `HIERARCHY_NODE_NOT_FOUND`.
4. **Given** a valid node with a deeply nested subtree, **Then** the full depth is returned without
   truncation.

---

### User Story 6 – Administrator Updates a Node (Priority: P2)

A Backoffice administrator updates a node's `name`, `description`, `status`, or `parent_id`.

**Why this priority:** Organizational structures change over time; nodes must support rename and
reparenting to keep the hierarchy accurate.

**Independent Test:** Create node "Team Alpha" under "Division A"; rename it to "Team Beta";
confirm the list endpoint returns the updated name with unchanged `id` and `parent_id`.

**Acceptance Scenarios:**

1. **Given** a node with `name = "Team Alpha"`, **When** an admin renames it to "Team Beta" (no
   sibling with that name exists under the same parent), **Then** the change is persisted and
   returned in the detail endpoint.
2. **Given** a rename to a name already used by a sibling under the same `parent_id`, **Then** the
   API returns 409 with `HIERARCHY_NODE_NAME_DUPLICATE`.
3. **Given** an admin reparents a node by changing `parent_id` to another existing node, **Then**
   the cycle-detection algorithm must verify the new `parent_id` is not a descendant of the node
   being moved; if no cycle is detected the update is persisted.
4. **Given** a reparenting that would create a cycle (the new `parent_id` is a descendant of the
   node being updated), **Then** the API returns 422 with
   `HIERARCHY_NODE_CYCLE_DETECTED`.
5. **Given** a `parent_id` set to the node's own `id`, **Then** the API returns 422 with
   `HIERARCHY_NODE_SELF_REFERENCE`.
6. **Given** a `parent_id` referencing a non-existent node, **Then** the API returns 422 with
   `HIERARCHY_NODE_PARENT_NOT_FOUND`.
7. **Given** a status change from `ENABLED` to `DISABLED`, **Then** the node is marked DISABLED;
   existing staff assignments remain valid; no new staff assignment to the DISABLED node is allowed
   after the change.
8. **Given** a status change from `DISABLED` to `ENABLED`, **Then** the node is marked ENABLED and
   new staff assignments become permissible again.

---

### User Story 7 – Administrator Deletes a Node (Priority: P2)

A Backoffice administrator deletes a leaf node (no children, no staff assignments).

**Why this priority:** Stale organizational nodes must be removed to keep the hierarchy clean.

**Independent Test:** Create a leaf node with no children and no staff assignments; delete it;
confirm it no longer appears in the list or tree endpoints.

**Acceptance Scenarios:**

1. **Given** a leaf node (no children) with no staff assignments, **When** a delete request is
   sent, **Then** the node is removed and the response returns 200 with `{ deleted: true }`.
2. **Given** a node that has one or more children, **When** a delete request is sent, **Then** the
   API returns 422 with `HIERARCHY_NODE_HAS_CHILDREN`.
3. **Given** a node that has assigned staff members (`hierarchy_node_id` referenced in `users`),
   **When** a delete request is sent, **Then** the API returns 422 with
   `HIERARCHY_NODE_HAS_STAFF`.
4. **Given** a DISABLED node with no children and no staff assignments, **When** a delete request
   is sent, **Then** the deletion succeeds.
5. **Given** a node with both children and staff assignments, **When** a delete request is sent,
   **Then** the API returns 422 with `HIERARCHY_NODE_HAS_CHILDREN` (children blocking takes
   precedence; the response returns the single highest-priority blocking code).

---

### Edge Cases

- **Single-root workspace:** A workspace may have exactly one root node; users of the org-chart
  expect a single-rooted tree view; the spec allows multiple roots but UIs should gracefully render
  multi-root scenarios.
- **DISABLED parent, ENABLED child:** The system permits a child to remain ENABLED when its parent
  is DISABLED. Status is per-node only. The tree traversal endpoint returns each node's own status.
- **Reparenting to a different root subtree:** Allowed as long as cycle detection passes.
- **Name uniqueness scope:** "Marketing" is allowed as both a child of "Europe" and a child of
  "Asia" — uniqueness is per `(parent_id, name)` scope (case-insensitive). At the root level,
  scope is `(NULL, name)`.
- **Deeply nested tree traversal:** Recursive traversal must not hit stack overflow for deep trees.
  The implementation must use an iterative approach or database-native recursive CTE.
- **Staff assignment blocked after node disabled:** If a node is disabled mid-session, any pending
  assignment attempt targeting it must be rejected even if the client's UI has not refreshed.
- **Cycle detection algorithm:** Must walk the ancestor chain of the proposed `parent_id` until it
  finds the root or the node being updated. If the node being updated appears in the ancestor
  chain, a cycle is detected.
- **Idempotent create not applicable:** Node creation is non-idempotent by design; duplicate names
  within the same scope are rejected with 409.

---

## Functional Requirements

- **FR-001**: The system MUST store hierarchy nodes within the tenant DB in a `hierarchy_nodes`
  table with columns: `id` (UUID, PK), `name` (varchar, NOT NULL), `parent_id` (UUID, nullable,
  FK → `hierarchy_nodes.id`, ON DELETE RESTRICT), `description` (text, nullable), `status`
  (`VARCHAR(20)` NOT NULL, default `'ENABLED'`, with a `CHECK (status IN ('ENABLED', 'DISABLED'))`
  constraint — NOT a PostgreSQL native ENUM type), `created_at` (TIMESTAMPTZ), `updated_at`
  (TIMESTAMPTZ).
- **FR-002**: `name` MUST be unique within the same `parent_id` scope (case-insensitive) — i.e.,
  the unique constraint is on `(parent_id, lower(name))`. For root nodes (`parent_id IS NULL`),
  uniqueness is enforced among all root nodes.
- **FR-003**: `parent_id` MUST reference an existing `hierarchy_nodes.id` within the same tenant
  DB when provided, or be `NULL` for root nodes.
- **FR-004**: A node's `parent_id` MUST NOT equal its own `id`. Self-reference is prohibited and
  MUST be rejected at the API layer with `HIERARCHY_NODE_SELF_REFERENCE`.
- **FR-005**: Circular hierarchy MUST be strictly prohibited. The API MUST execute a cycle-
  detection check before committing any update operation that changes `parent_id`.
  If a cycle is detected, the operation MUST be rejected with `HIERARCHY_NODE_CYCLE_DETECTED`.
  Note: Cycle detection is not applicable at node creation time — a newly created node's `id` is
  server-generated (UUID) and therefore cannot exist in the ancestor chain of any proposed
  `parent_id` at the moment of creation.
- **FR-006**: Cycle detection MUST be performed at the API layer (application code) — it MUST NOT
  rely solely on DB-level CHECK constraints. The algorithm MUST walk the ancestor chain of the
  proposed `parent_id` using DB queries inside the same transaction.
- **FR-007**: Deleting a node that has one or more child nodes MUST be rejected with
  `HIERARCHY_NODE_HAS_CHILDREN`. The check MUST execute inside the delete transaction.
- **FR-008**: Deleting a node that is referenced by the `hierarchy_node_id` FK in the `users`
  table MUST be rejected with `HIERARCHY_NODE_HAS_STAFF`. The DB-level `ON DELETE RESTRICT`
  provides the enforcement backstop; the API MUST return the structured error before the DB
  constraint fires.
- **FR-009**: Hard delete is the REQUIRED strategy for `hierarchy_nodes` — soft delete (deleted_at)
  is NOT used for this entity. Deletion succeeds only when all blocking conditions (children,
  staff assignments) are resolved.
- **FR-010**: The system MUST provide a full-tree endpoint that returns all hierarchy nodes for the
  workspace as a nested JSON structure, with each node containing `id`, `name`, `description`,
  `status`, `parent_id`, and a `children` array.
- **FR-011**: The system MUST provide a flat-list endpoint that returns all hierarchy nodes as a
  flat array with `depth` field (0 = root) and supports optional `status` filter and pagination.
- **FR-012**: The system MUST provide a subtree endpoint that accepts a node `id` and returns that
  node and all its descendants in nested format.
- **FR-013**: Reparenting (changing `parent_id` during an update operation) MUST trigger the
  cycle-detection algorithm before committing the change.
- **FR-014**: Node `status` MUST be one of `ENABLED` or `DISABLED`. Creating a node with a `status`
  other than these two values MUST be rejected with `VALIDATION_ERROR`.
- **FR-015**: Staff assignment to a `DISABLED` hierarchy node MUST be rejected. This validation
  MUST be enforced in the downstream staff assignment stage referencing this contract.
- **FR-016**: All hierarchy API endpoints MUST apply the tenant resolver middleware and license
  middleware before any business logic executes.
- **FR-017**: All hierarchy list and traversal queries MUST scope results to the resolved tenant's
  DB connection; no cross-tenant queries.
- **FR-018**: All write operations (create, update, delete) MUST execute within a database
  transaction. No partial updates are permitted.
- **FR-019**: All timestamps (`created_at`, `updated_at`) MUST be set server-side. No
  client-supplied timestamps are accepted.
- **FR-020**: The `hierarchy_nodes` table MUST have indexes on `parent_id` and `status` to support
  efficient tree traversal and status filtering.
- **FR-021**: All API responses MUST follow the error contract:
  `{ success: boolean, data: object | null, error: { code: string, message: string, correlationId: string } | null }`.
  The `correlationId` field in error sub-objects MUST be propagated from the request's
  `X-Correlation-ID` header (or a generated UUID if absent) to allow log correlation.
- **FR-022**: All service-layer logs MUST be structured and include: `timestamp`, `level`,
  `service`, `workspace_slug`, `workspace_id`, `user_id` (if available), `correlation_id`, and
  `hierarchy_node_id` (for node-specific operations). `console.log` is forbidden.
- **FR-023**: The create operation MUST be non-idempotent by design (duplicate names within scope
  return 409). The update operation MUST be safe to retry with the same payload (last-write wins
  on non-conflicting fields).
- **FR-024**: The CRUD endpoints MUST require authenticated staff with the appropriate hierarchy
  management permission. Unauthorized access MUST return 403.
- **FR-025**: The `name` field MUST reject blank or whitespace-only values. Server-side trimming
  MUST be applied before uniqueness and non-blank validation.

---

## Data Model

### Table: `hierarchy_nodes` (Tenant DB)

| Column        | Type                                                  | Nullable | Default           | Notes                                                                             |
| ------------- | ----------------------------------------------------- | -------- | ----------------- | --------------------------------------------------------------------------------- |
| `id`          | UUID                                                  | NO       | gen_random_uuid() | Primary key                                                                       |
| `name`        | VARCHAR(255)                                          | NO       |                   | Trimmed before storage; unique per parent scope                                   |
| `parent_id`   | UUID                                                  | YES      | NULL              | FK → `hierarchy_nodes.id` ON DELETE RESTRICT                                      |
| `description` | TEXT                                                  | YES      | NULL              |                                                                                   |
| `status`      | VARCHAR(20) CHECK (status IN ('ENABLED', 'DISABLED')) | NO       | 'ENABLED'         | NOT a PostgreSQL ENUM type; uses VARCHAR + CHECK constraint for easier migrations |
| `created_at`  | TIMESTAMPTZ                                           | NO       | now()             | Server-set only                                                                   |
| `updated_at`  | TIMESTAMPTZ                                           | NO       | now()             | Server-set only; updated on every write                                           |

**Constraints:**

- `PRIMARY KEY (id)`
- `FOREIGN KEY (parent_id) REFERENCES hierarchy_nodes(id) ON DELETE RESTRICT`
- `CHECK (parent_id <> id)` — prohibits self-reference at DB layer
- `UNIQUE (parent_id, lower(name))` — partial unique index over `(parent_id, lower(name))`;
  for root nodes, use a partial unique index: `UNIQUE (lower(name)) WHERE parent_id IS NULL`

**Indexes:**

- `INDEX ON hierarchy_nodes (parent_id)` — tree traversal
- `INDEX ON hierarchy_nodes (status)` — status filtering

### Interface Contract: `users` Table FK (Downstream Stage)

The downstream staff assignment stage MUST add:

| Column              | Type | Nullable | Notes                                        |
| ------------------- | ---- | -------- | -------------------------------------------- |
| `hierarchy_node_id` | UUID | YES      | FK → `hierarchy_nodes.id` ON DELETE RESTRICT |

Rules enforced by the downstream stage:

- Nullable during bootstrap; required after bootstrap is complete.
- Assignment must reference an `ENABLED` node.
- Cannot assign to a `DISABLED` node.
- The `ON DELETE RESTRICT` FK ensures no `hierarchy_nodes` row can be deleted while staff are
  assigned to it.

---

## API Endpoints

**Canonical base path:** All hierarchy endpoints are mounted under
`/api/v1/backoffice/workspace/hierarchy-nodes` at runtime. This mirrors the existing Backoffice
mount pattern already used by translations, workflow, roles, divisions, departments, and groups in
`apps/api/src/app.ts`. The short-form paths below (for example `POST /hierarchy-nodes`) describe
the suffix registered by the hierarchy router; the full runtime URL always includes the
`/api/v1/backoffice/workspace` prefix.

### `POST /hierarchy-nodes`

Create a new hierarchy node.

**Request Body:**

```json
{
  "name": "string (required, non-blank, max 255 chars)",
  "parent_id": "uuid | null",
  "description": "string | null",
  "status": "ENABLED | DISABLED (optional, defaults to ENABLED)"
}
```

**Response 201 Created:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "parent_id": "uuid | null",
    "description": "string | null",
    "status": "ENABLED",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  },
  "error": null
}
```

**Error codes:** `VALIDATION_ERROR` (422), `HIERARCHY_NODE_NAME_DUPLICATE` (409),
`HIERARCHY_NODE_PARENT_NOT_FOUND` (422), `FORBIDDEN` (403), `LICENSE_REQUIRED` (423/403/404).

---

### `GET /hierarchy-nodes`

Flat list of all hierarchy nodes with optional filters and pagination.

**Query Parameters:** `status` (optional: ENABLED | DISABLED), `page` (default 1), `per_page`
(default 20, max 100).

**Response 200:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "string",
        "parent_id": "uuid | null",
        "description": "string | null",
        "status": "ENABLED | DISABLED",
        "depth": 0,
        "created_at": "ISO8601",
        "updated_at": "ISO8601"
      }
    ],
    "total": 0,
    "page": 1,
    "per_page": 20
  },
  "error": null
}
```

---

### `GET /hierarchy-nodes/tree`

Full nested tree of all hierarchy nodes.

**Query Parameters:** `status` (optional).

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "parent_id": null,
      "description": "string | null",
      "status": "ENABLED",
      "depth": 0,
      "children": [
        {
          "id": "uuid",
          "name": "string",
          "parent_id": "uuid",
          "description": "string | null",
          "status": "ENABLED",
          "depth": 1,
          "children": []
        }
      ]
    }
  ],
  "error": null
}
```

---

### `GET /hierarchy-nodes/:id/subtree`

Nested subtree rooted at a specific node.

**Query Parameters:** `status` (optional: `ENABLED` | `DISABLED`) — when supplied, DISABLED nodes
and their entire subtrees are pruned from the response (subtree exclusion semantics).

**Response 200:** Same shape as the full tree endpoint but rooted at the requested node.

**Error codes:** `HIERARCHY_NODE_NOT_FOUND` (404).

---

### `GET /hierarchy-nodes/:id`

Single node detail.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "parent_id": "uuid | null",
    "description": "string | null",
    "status": "ENABLED | DISABLED",
    "depth": 0,
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  },
  "error": null
}
```

Note: `depth` is 0 for root nodes, 1 for direct children of root, etc. Computed via ancestor-count
query at read time (not stored).

**Error codes:** `HIERARCHY_NODE_NOT_FOUND` (404).

---

### `PATCH /hierarchy-nodes/:id`

Partially update a hierarchy node (name, description, status, parent_id). PATCH semantics:
only fields explicitly provided in the request body are updated; omitted fields retain their
current values.

**Request Body:** Same shape as create; all fields optional; only provided fields are updated.

**Error codes:** `VALIDATION_ERROR` (422), `HIERARCHY_NODE_NAME_DUPLICATE` (409),
`HIERARCHY_NODE_NOT_FOUND` (404), `HIERARCHY_NODE_PARENT_NOT_FOUND` (422),
`HIERARCHY_NODE_SELF_REFERENCE` (422), `HIERARCHY_NODE_CYCLE_DETECTED` (422), `FORBIDDEN` (403).

---

### `DELETE /hierarchy-nodes/:id`

Delete a hierarchy node. Blocked if children exist or staff are assigned.

**Response 200:**

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error codes:** `HIERARCHY_NODE_NOT_FOUND` (404), `HIERARCHY_NODE_HAS_CHILDREN` (422),
`HIERARCHY_NODE_HAS_STAFF` (422), `FORBIDDEN` (403).

---

## Success Criteria

1. Staff with hierarchy management permission can create nodes at any depth without restriction —
   at least a 10-level deep tree must be representable without error.
2. Any attempt to create a circular hierarchy reference is rejected with a specific error before
   the write is committed, regardless of tree depth or concurrency.
3. The full-tree endpoint returns all nodes for a workspace in a correctly nested structure in
   under 2 seconds for trees up to 500 nodes.
4. Deleting a parent node is blocked whenever it has at least one child node; the error response
   includes the specific blocking condition.
5. Deleting a node assigned to at least one staff member is blocked; the error response includes
   the specific blocking condition.
6. Reparenting a node correctly updates all tree traversal responses without orphaning any
   descendant.
7. Name uniqueness is enforced per parent scope independently — the same name may appear under
   different parents; duplicate names under the same parent are consistently rejected.
8. Status toggling (ENABLE/DISABLE) takes effect immediately on subsequent read and assignment
   endpoints without cache inconsistency.
9. All endpoints observe tenant isolation — a hierarchy node created in workspace A is never
   visible in workspace B.
10. All write operations complete atomically — no partial state is observable after any error.

---

## Key Entities

| Entity            | Type            | Description                                                  |
| ----------------- | --------------- | ------------------------------------------------------------ |
| `hierarchy_nodes` | Tenant DB table | Self-referencing organizational tree node                    |
| `users`           | Tenant DB table | Downstream FK target for staff-to-node assignment (contract) |

---

## Assumptions

1. Permission checks for hierarchy management are handled by the existing role-permission system
   (STAGE_21); the hierarchy endpoints do not implement their own permission model beyond
   delegating to the shared Backoffice JWT middleware and the per-route RBAC guard.
2. No global limit on the total number of hierarchy nodes per workspace is required in this stage.
3. Cycle detection uses a recursive ancestor walk (iterative, using DB queries) rather than
   relying on a DB-native recursive CTE or triggers; this ensures the check and the write occur
   atomically inside the same transaction.
4. Hard delete (no `deleted_at` soft-delete) is used for `hierarchy_nodes`, consistent with the
   blocking constraints at deletion time ensuring no orphaned references exist.
5. The downstream staff assignment stage is responsible for adding `hierarchy_node_id` to the
   `users` table and enforcing the single-node assignment rule; this stage delivers only the tree
   structure and the interface contract.
6. `depth` in flat-list and tree responses is computed by the API layer at query time; it is NOT
   stored as a column in the `hierarchy_nodes` table.
7. Case-insensitive name uniqueness is enforced via a functional unique index using `lower(name)`.
8. The `ON DELETE RESTRICT` FK on `parent_id` is a backstop; the API layer must check for children
   before deletion and return the structured error code rather than surfacing a raw DB error.
9. **Offset-based pagination (`page` / `per_page`) is the intentional choice for the flat-list
   endpoint** (`GET /hierarchy-nodes`). This is a deliberate architectural deviation from the
   platform cursor-based pagination standard: hierarchy node sets are workspace-scoped and
   structurally bounded (well under 10 000 nodes per workspace). The `ORDER BY depth ASC,
name ASC, id ASC` clause guarantees deterministic, stable page results without cursor
   book-keeping. Cursor-based pagination adds implementation and API complexity with no
   measurable P99 latency benefit at this entity scale. No ADR exception is required for
   bounded internal entity sets. This assumption is the authoritative justification for
   offset pagination in this stage.
10. Reparenting operations must be serialized against both the node being moved and the proposed
    parent row. The API layer achieves this by locking both rows in deterministic order before the
    ancestor walk runs, preventing reciprocal concurrent moves from committing a cycle.

---

## Explicit Non-Goals

- **Academic visibility control:** Hierarchy does not affect exam assignments, exam filtering,
  content scoping, or student access.
- **Student assignment:** Students are never assigned to hierarchy nodes. The hierarchy is staff-
  only organizational metadata.
- **Division or department integration:** Hierarchy nodes are independent of Divisions and
  Departments; no FK relationship exists between these entities in this stage.
- **Org-chart UI rendering:** The spec defines API shape only; the frontend rendering of org-charts
  is a UI component concern (downstream).
- **Soft delete / archiving:** Nodes are hard-deleted; soft delete with `deleted_at` is out of
  scope for this entity.
- **Bulk operations:** Bulk create, bulk delete, and bulk status toggle are out of scope.
- **Move-subtree as atomic operation:** This stage supports reparenting of a single node; moving
  an entire subtree atomically is out of scope.
- **Historical hierarchy snapshots:** No audit log or version history for hierarchy state changes
  is required in this stage.
- **Permission grouping via hierarchy:** Future extension noted in the stage file; not implemented
  here.
- **Analytics rollup endpoint:** Hierarchy may be used for analytics aggregation in a downstream
  stage; this stage does not deliver that endpoint.

---

## Transaction Boundaries

| Operation                  | Transactional? | Notes                                                                                                 |
| -------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| Create node                | Yes            | Includes name-uniqueness check + parent validation                                                    |
| Update node (rename)       | Yes            | Includes name-uniqueness check within same transaction                                                |
| Update node (reparent)     | Yes            | Includes deterministic dual-row locking, cycle-detection ancestor walk, and write in same transaction |
| Delete node                | Yes            | Includes children check + staff check before hard delete in same transaction                          |
| Read (list, tree, subtree) | No             | Read-only; no transaction required                                                                    |

**Failure & Rollback:** Any error within a write transaction rolls back all changes. No partial
state is written. Retry is safe for read operations; write retries are safe for idempotent update
payloads (last-write wins on non-conflicting fields).

---

## Authoritative Time Usage

- `created_at` and `updated_at` are set by the tenant database using `NOW()` at write time.
- Client-supplied `created_at` or `updated_at` values in request bodies are ignored.
- No timer or deadline behavior exists in this stage (no attempt engine involvement).

---

## Idempotency Strategy

| Operation      | Idempotent? | Mechanism                                                                 |
| -------------- | ----------- | ------------------------------------------------------------------------- |
| Create node    | No          | Duplicate name within scope returns 409                                   |
| Update node    | Yes         | Repeated update with same payload returns 200; no duplicate state created |
| Delete node    | No (404)    | Deleting a non-existent node returns 404                                  |
| Read endpoints | Yes         | Reads are fully idempotent                                                |

---

## Observability Requirements

All service methods must emit structured logs using the platform's structured logger.

**Required fields per log entry:**

| Field               | Required?  | Notes                                 |
| ------------------- | ---------- | ------------------------------------- |
| `timestamp`         | Yes        | Server-authoritative ISO8601          |
| `level`             | Yes        | `info`, `warn`, `error`               |
| `service`           | Yes        | `hierarchy-nodes`                     |
| `workspace_slug`    | Yes        | Resolved from tenant context          |
| `workspace_id`      | Yes        | Resolved from tenant context          |
| `user_id`           | Yes        | When available from auth context      |
| `correlation_id`    | Yes        | Propagated from request headers       |
| `hierarchy_node_id` | Contextual | Included for node-specific operations |

`console.log` is forbidden. All logs must go through the platform structured logger.

---

## Rate Limiting & Abuse Protection

| Endpoint class             | Classification      | Rate Limit Policy                                                                                       |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| CRUD write endpoints       | Authenticated staff | Standard authenticated rate limit per workspace                                                         |
| Read / traversal endpoints | Authenticated staff | Standard authenticated rate limit per workspace + per-query `statement_timeout = 5000ms` DB-level guard |

No public endpoints exist for hierarchy nodes. All endpoints require authenticated staff access
with the appropriate workspace license check.

The full-tree (`GET /hierarchy-nodes/tree`) and subtree (`GET /hierarchy-nodes/:id/subtree`)
endpoints execute `WITH RECURSIVE` CTEs whose cost scales with tree depth and node count.
A **5-second `statement_timeout`** MUST be applied to every connection used by these endpoints
to prevent runaway queries from exhausting the tenant DB connection pool. If the query exceeds
the timeout, the handler returns 503 with `HIERARCHY_TRAVERSAL_TIMEOUT`.

**Pagination strategy (flat-list):** Offset-based pagination is used for `GET /hierarchy-nodes`
rather than cursor-based because the hierarchy node set is workspace-scoped and expected to remain
bounded (well under 10 000 nodes per workspace). Cursor-based pagination would add complexity with
no meaningful performance benefit at this scale. This deviation from the platform default
cursor strategy is intentional and documented here.

**Auth clarification:** HTTP 401 is returned by the shared Backoffice JWT middleware when no valid
staff JWT is present (unauthenticated). HTTP 403 is returned by the per-route RBAC guard
(`createPermissionGuard(..., PermissionModule.ACADEMIC_STRUCTURE, ...)`) when the authenticated
staff user lacks the required `can_view`, `can_create`, `can_edit`, or `can_delete` capability
(unauthorized). These two codes apply at distinct middleware layers and are not interchangeable.

---

## Layer Separation Confirmation

| Rule                                       | Confirmed? | Notes                                                    |
| ------------------------------------------ | ---------- | -------------------------------------------------------- |
| Frontend contains no business logic        | ✓          | Cycle detection, constraint checks run at API layer only |
| API contains no grading logic              | ✓          | Feature does not touch grading                           |
| Worker contains no HTTP logic              | ✓          | No worker involvement                                    |
| MMC does not access tenant DB              | ✓          | No MMC involvement                                       |
| No direct DB creation outside provisioning | ✓          | All DB access via tenant resolver context                |
| No UI business logic                       | ✓          | Status validation, cycle detection, name uniqueness: API |

---

## Failure Modes & Recovery

| Failure Mode                       | Behavior                                                          |
| ---------------------------------- | ----------------------------------------------------------------- |
| DB unavailable on write            | Transaction fails; 500 returned; logged with correlation_id       |
| DB unavailable on read             | 500 returned; logged                                              |
| License validation fails           | 423/403/404 per license state; no DB access attempted             |
| Cycle detected during reparent     | Transaction rolled back; 422 with `HIERARCHY_NODE_CYCLE_DETECTED` |
| Parent not found on create/update  | 422 with `HIERARCHY_NODE_PARENT_NOT_FOUND`; no write committed    |
| Delete blocked (children or staff) | 422 with appropriate error code; no write committed               |
| Name collision on create or rename | 409 with `HIERARCHY_NODE_NAME_DUPLICATE`; no write committed      |
| Partial transaction failure        | Full rollback; no partial node state is observable                |

---

## Test Strategy

### Unit Tests

- Cycle-detection algorithm: tests for direct cycle, indirect cycle at various depths, valid
  reparenting when no cycle exists, self-reference, and empty ancestor chain (root node).
- Name uniqueness validator: same name under same parent (reject), same name under different
  parents (allow), root-level collision (reject).
- Node deletion guard: children present (reject), no children but staff assigned (reject), no
  children and no staff (allow), DISABLED node with no blockings (allow).
- Status validation: invalid status value (reject), valid ENABLED/DISABLED (allow).

### Integration Tests

- Full CRUD lifecycle: create root → create child → read tree → update child name → delete child
  → verify tree.
- Reparent with cycle attempt: create A → B → C, attempt to reparent A under C (cycle) → verify 422.
- Reparent without cycle: create A → B → C, reparent B under a new root D → verify tree is
  correct and no orphans.
- Deletion guard: create parent → create child → attempt to delete parent → verify 422.
- Tenant isolation: create node in workspace A, verify workspace B returns empty tree.
- License enforcement: attempt hierarchy operation with SOFT_LOCKED license → 423.
- Status block: create node, disable it, attempt to toggle it back, verify transitions.
- Flat-list depth: create 3-level tree, verify `depth` values (0, 1, 2) are correct.
- Subtree: create 3-level tree, request subtree from level-1 node, verify level-2 and level-3
  nodes are present but level-0 root is absent.
- Pagination: create 25 nodes, request `page=2&per_page=10`, verify correct slice.

### Transaction Rollback Tests

- Simulate DB error mid-transaction during create; verify no partial node exists.
- Simulate cycle detection triggering after partial ancestor walk; verify full rollback.

### Idempotency Tests

- Repeated `PATCH` with same payload returns 200 and does not change `updated_at` erroneously.

### Isolation Tests

- Cross-tenant node visibility: confirmed zero cross-tenant leakage.
- Confirmed `ON DELETE RESTRICT` prevents hierarchy node deletion when staff FK references exist.

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Clarifications

### Session 2026-03-19

- Q: What locking strategy prevents a concurrent-reparent race where two simultaneous transactions
  both pass the cycle-detection ancestor walk and commit, potentially creating a cycle? → A:
  Acquire `SELECT ... FOR UPDATE` on both the node being updated and the proposed parent row at the
  start of any transaction that changes `parent_id`, using deterministic lock order (lower UUID,
  then higher UUID) to avoid deadlocks. This dual-row lock forces reciprocal concurrent reparent
  operations (`A → B` and `B → A`) to serialize before the ancestor walk runs, eliminating the
  TOCTOU window between cycle detection and commit. Success Criteria #2 ("regardless of
  concurrency") requires this dual-row lock strategy rather than a single-row lock.

- Q: Which tree and subtree traversal strategy is authoritative — application-level iterative DB
  queries (N+1 pattern) or a single PostgreSQL recursive CTE? → A: A single PostgreSQL recursive
  CTE (`WITH RECURSIVE`) is the required strategy for all read traversal operations (full-tree,
  subtree, and flat-list-with-depth endpoints). The recursive CTE fetches the entire relevant node
  set in one DB round-trip; the API layer then assembles the nested `children` structure or `depth`
  field in application memory. This is consistent with FR-020's `INDEX ON hierarchy_nodes
(parent_id)` requirement, avoids N+1 query amplification for deep trees, and meets the
  sub-2-second SLA for trees up to 500 nodes (Success Criteria #3). The "iterative approach" in
  the Edge Cases section applies exclusively to cycle-detection ancestor walking inside write
  transactions (FR-006, Assumption 3), not to read traversal.

- Q: What is the canonical sort order for the flat-list endpoint, and is it stable enough to make
  offset-based pagination deterministic across sequential requests? → A: The flat-list endpoint
  MUST sort results by `(depth ASC, name ASC, id ASC)` as the stable, deterministic default order.
  Depth is ascending (root nodes first), within each depth level nodes are ordered alphabetically
  by `name` case-insensitively, and `id ASC` is the deterministic tiebreaker. This ordering MUST
  be applied before applying the `OFFSET` / `LIMIT` pagination slice, ensuring page boundaries are
  reproducible. No alternative sort order is supported in this stage. The `ORDER BY` must be
  included in the recursive CTE or the final query to guarantee stability.

- Q: When a `status=ENABLED` filter is applied to the nested-tree or subtree endpoints, should an
  ENABLED node whose immediate parent is DISABLED (a permitted data state per the Edge Cases
  section) appear in the response as a promoted root-level entry, or should it be excluded because
  it is a descendant of a DISABLED subtree? → A: **Subtree exclusion is authoritative.** User
  Story 3 Scenario 4 explicitly states "DISABLED nodes and their subtrees are excluded" when the
  `status=ENABLED` filter is active. This means the tree builder MUST prune any node that is
  DISABLED along with its entire descendant subtree, regardless of each descendant's individual
  `status` value. An ENABLED node contained within a DISABLED subtree is NOT promoted to root
  level; it is omitted entirely from the filtered response. The Edge Cases note ("Status is
  per-node only") describes the data model storage rule — a DISABLED parent does not automatically
  DISABLE its children's `status` column — but it does NOT override the tree-endpoint filter
  semantics. The unfiltered full-tree endpoint (no `status` parameter) always returns every node
  regardless of status and always reflects per-node status accurately.

- Q: Should `updated_at` be bumped on every accepted `PATCH` write, or should the service perform a
  field-level diff and skip the DB write (leaving `updated_at` unchanged) when the incoming
  payload matches the current stored state? → A: `updated_at` is updated on every accepted `PATCH`
  write unconditionally — including when all payload fields match the current stored values.
  The idempotency test assertion "does not change `updated_at` erroneously" means the timestamp
  MUST be server-set and MUST NOT accept a client-supplied value; it does not mandate no-op
  suppression. The service MUST NOT implement field-level diff detection to skip DB writes. This
  aligns with the data model's "updated on every write" definition, avoids hidden diff complexity,
  and ensures that every accepted PATCH produces a predictable audit trail. Callers that require
  last-seen-timestamp comparison must use `GET` before `PATCH`.
