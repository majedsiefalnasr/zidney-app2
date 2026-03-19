# STAGE 25 – Hierarchy Tree

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB only

---

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: MEDIUM
Last Updated: 2026-03-19T13:24:10Z

Tasks Generated:

- Total: 21 atomic tasks
- Categories: migration, domain, validation, API routes, router registration, testing
- Parallel groups defined for domain primitives, route handlers, and test suites

Deferred Scope:

- Staff assignment to hierarchy nodes — downstream stage concern
- Frontend org-chart UI rendering — downstream stage concern

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation

Notes:
Atomic task set generated. Drift analysis gate pending.

---

## Objective

Implement a staff-only organizational hierarchy tree.

Hierarchy is used for:

- Reporting structure
- Organizational chart representation
- Managerial segmentation
- Internal analytics

Hierarchy does NOT:

- Control academic visibility
- Affect exam filtering
- Affect division-based access rules
- Affect student assignment

Hierarchy is strictly organizational.

---

## Data Model

Table: hierarchy_nodes

Columns:

- id (UUID, primary key)
- name (varchar, required)
- parent_id (UUID, nullable, self-reference)
- description (text, nullable)
- status (VARCHAR(20) with CHECK constraint: ENABLED | DISABLED)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)

Constraints:

- parent_id references hierarchy_nodes.id
- parent cannot equal id
- name must be unique within same parent scope
- Circular reference strictly prohibited

Indexes required:

- index(parent_id)
- index(status)

---

## Tree Rules

- Unlimited depth allowed
- Circular hierarchy strictly prohibited
- Parent deletion blocked if children exist
- Reparenting must validate no cycle creation
- Root node allowed (parent_id NULL)

Cycle detection must be enforced at API layer.

---

## Staff Assignment Model

Staff must belong to exactly one hierarchy node.

users table must contain:

- hierarchy_node_id (nullable only during bootstrap)

Rules:

- hierarchy_node_id required after bootstrap complete
- Assignment must reference ENABLED node
- Cannot assign to DISABLED node

Validation must occur at backend layer.

---

## Status Behavior

ENABLED:

- Node visible in assignment lists
- Staff can be assigned

DISABLED:

- Cannot assign new staff
- Existing assignments remain valid
- Cannot delete unless no children and no staff assigned

---

## Referential Integrity Rules

Foreign key behavior:

- hierarchy_node_id in users → ON DELETE RESTRICT
- parent_id → ON DELETE RESTRICT

Node cannot be deleted if:

- Has children
- Has assigned staff

Deletion must be explicit and validated.

---

## Reporting Usage

Hierarchy may be used for:

- Manager-level reporting
- Aggregated statistics per node
- Permission grouping (future extension)

Hierarchy must not override division isolation rules.

Division boundary always enforced first.

---

## Isolation Guarantees

- Hierarchy exists per tenant DB
- No cross-tenant hierarchy reference
- No global hierarchy table
- No hierarchy-based cross-division leakage

---

## Validation Criteria

Stage complete when:

- Unlimited depth supported
- Cycle detection enforced
- Staff single-node constraint enforced
- Disabled node assignment blocked
- Deletion restrictions enforced
- FK integrity verified

---

## Not Allowed

- Circular hierarchy
- Multiple hierarchy nodes per staff
- Hierarchy used for academic filtering
- Hard delete bypassing constraints
- UI-only validation

---

Next: STAGE_26_TEAMS
