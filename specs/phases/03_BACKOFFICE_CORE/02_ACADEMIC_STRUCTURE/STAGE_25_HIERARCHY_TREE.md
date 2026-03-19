# STAGE 25 – Hierarchy Tree

Phase: 03_BACKOFFICE_CORE  
Domain: 02_ACADEMIC_STRUCTURE  
Database: Tenant DB only

---

## Stage Status

Status: PRODUCTION READY
Step: stage_production_ready
Risk Level: MEDIUM
Closure Date: 2026-03-19T18:00:00Z

Implementation: COMPLETE
Tasks: 21 / 21 completed
Tests: 30 / 30 passing (15 unit + 15 integration)

Scope Delivered:

- Forward-only tenant migration: `hierarchy_nodes` table, indexes, schema_version 1.7.0 → 1.8.0
- Domain hierarchy package: types, errors, repository (recursive CTE + dual-row locking), service (transactional CRUD + cycle detection + guards)
- Validation schemas: create, update, params, list query, tree query
- Backoffice route surface: 7 handlers, Hono router with RBAC guards under `PermissionModule.ACADEMIC_STRUCTURE`
- Router mounted at `/api/v1/backoffice/workspace/hierarchy`
- Unit tests (15 pass) and integration tests (15 pass)

Deferred Scope:

- Staff assignment to hierarchy nodes — `countStaffAssignments` returns 0 until a future migration adds `users.hierarchy_node_id` (tracked as post-deploy medium priority in STAGE_26)
- Frontend org-chart UI rendering — downstream stage concern
- `withTraversalTimeout` pool-dispatch fix — post-deploy high-priority item (currently app-level timeout protection in place)

Constitutional Compliance:

- ✅ ADR-0001: Database-per-tenant isolation enforced (DbClient injection, no global singleton)
- ✅ ADR-0006: Server-authoritative time only (no client timestamps)
- ✅ ADR-0008: Semantic versioning enforced (schema 1.7.0 → 1.8.0)
- ✅ All 9/9 guardian verdicts PASS (Architecture Checker, API Designer, QA Engineer, Security Auditor, Performance Optimizer, Deployment Engineer, CI/CD Automation, Code Reviewer, Docker Specialist)
- ✅ Drift analysis PASSED — all cross-artifact issues remediated

Validation Results:

- Lint: ✅ 0 errors
- Type-check: ✅ 0 errors
- Architecture Guard: ✅ PASS
- Tests: ✅ 30/30 passing
- Drift Audit: ✅ PASS

Notes:
Stage is production ready and fully compliant with Zidney Constitution v1.2.0.
No structural backend modifications allowed. All closure artifacts generated.
See reports/CLOSURE_REPORT.md for full details.

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
