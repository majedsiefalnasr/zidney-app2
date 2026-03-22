# Security Checklist — Categories (Classification Dimensions)

**Purpose**: Validate that security properties are fully, clearly, and consistently specified in the Categories spec — covering authorization, tenant isolation, input validation, error disclosure, concurrency safety, audit integrity, and constitutional compliance.
**Created**: 2026-03-22
**Feature**: [spec.md](../spec.md)
**Stage**: STAGE_30_CATEGORIES
**Phase**: 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION

---

## Authorization Requirements Completeness

- [ ] CHK001 — Are permission requirements specified individually for all 6 route operations (GET /categories, GET /categories/tree, GET /categories/:id, POST, PATCH, DELETE) rather than grouped as "write vs read"? [Completeness, Spec §Access Control]
- [ ] CHK002 — Is the permission check failure mode fully quantified (HTTP 403 + `FORBIDDEN` error code) for every write endpoint? [Clarity, Spec §Access Control]
- [ ] CHK003 — Are read endpoint authentication requirements (authenticated session + valid license) clearly distinguished from write endpoint authorization requirements (session + license + permission)? [Clarity, Spec §Access Control]
- [ ] CHK004 — Is the mandatory middleware positioning of `requirePermission` (after tenant resolver and license middleware, before the handler) explicitly stated rather than implied? [Completeness, Spec §Access Control]
- [ ] CHK005 — Is it specified that `question_manage` OR `classification_manage` is sufficient (disjunctive) — not requiring both simultaneously? [Clarity, Spec §Access Control]

---

## Tenant Isolation Requirements

- [ ] CHK006 — Is the 404-not-403 information-disclosure prevention rule for cross-tenant ID requests explicitly stated as a security requirement, not just a functional behavior? [Completeness, Spec §US-04]
- [ ] CHK007 — Is the tenant resolution mechanism (subdomain/path slug extraction) and its mandatory execution before all handlers specified in enough detail that no implementation ambiguity remains? [Completeness, Spec §Isolation Impact Analysis]
- [ ] CHK008 — Is the prohibition of master DB access (zero master DB access) specified as a hard constraint, not just an aspiration? [Completeness, Spec §Isolation Impact Analysis]
- [ ] CHK009 — Are `ON DELETE CASCADE` semantics on `category_subjects` and `category_divisions` documented as preventing orphaned cross-tenant scope references on subject/division deletion? [Coverage, Spec §Data Model]
- [ ] CHK010 — Is it specified that the global connection pool singleton pattern is prohibited — every query must go through the per-tenant pool injected via `c.get('tenant').pool`? [Completeness, Spec §Isolation Impact Analysis]

---

## Input Validation Requirements

- [ ] CHK011 — Are maximum length constraints defined for all string fields receiving user input (`name` max 255, `code` max 100, `search` max 100)? [Completeness, Spec §Validation Rules]
- [ ] CHK012 — Is UUID format validation explicitly required on all path parameters (`id`) and foreign-key array elements (`subject_ids`, `division_ids`, `parent_id`, `root_id`)? [Completeness, Spec §Validation Rules]
- [ ] CHK013 — Are requirements defined for maximum array size on `subject_ids` and `division_ids` to prevent unbounded scope list injection? [Gap]
- [ ] CHK014 — Is the `search` field's safe query handling requirement stated (parameterized `ILIKE` — never string interpolation) to prevent SQL injection? [Gap]
- [ ] CHK015 — Is the requirement that the PATCH body must contain at least one field (preventing empty-body requests) specified as a validation rule? [Completeness, Spec §Validation Rules]
- [ ] CHK016 — Is the `status` field validated against an explicit enum (`ENABLED | DISABLED` only) with rejection of any other value? [Completeness, Spec §Validation Rules]

---

## Error Response Security Requirements

- [ ] CHK017 — Is the prohibition on returning stack traces in API responses explicitly stated as a security requirement? [Completeness, Spec §Error Handling]
- [ ] CHK018 — Are requirements defined for which fields are safe to include in error `message` strings (i.e., no internal DB details, no tenant-private IDs leaked)? [Gap]
- [ ] CHK019 — Is the 404-vs-403 distinction for tenant boundary enforcement explicitly documented as an information-leakage prevention rule? [Completeness, Spec §US-04]
- [ ] CHK020 — Are DB-level constraint violation codes (e.g., PostgreSQL `23505`) required to be caught and translated to domain error codes before reaching the API response layer — preventing internal DB error exposure? [Completeness, Spec §Error Handling]

---

## Concurrency & Race Condition Requirements

- [ ] CHK021 — Is the SELECT FOR UPDATE locking requirement for hierarchy-mutating operations defined with enough specificity that concurrent race conditions on parent-depth data are explicitly prevented? [Completeness, Spec §BR-14]
- [ ] CHK022 — Is the scope of SELECT FOR UPDATE locks for each operation type (createCategory locks parent row; updateCategory/deleteCategory lock target row) unambiguously specified? [Clarity, Spec §BR-14]
- [ ] CHK023 — Is the deleteCategory SELECT FOR UPDATE requirement (lock target row always, not only on parent_id change) specified as the mechanism preventing concurrent re-enable during a disable operation? [Completeness, Spec §BR-14]
- [ ] CHK024 — Are requirements defined to prevent a Time-of-Check/Time-of-Use (TOCTOU) race on the `CATEGORY_HAS_ENABLED_CHILDREN` guard — specifically that the child check and the status update execute within the same transaction holding the lock? [Gap]

---

## Audit Trail Requirements

- [ ] CHK025 — Is `created_by` immutability (set once at creation, never modified on subsequent updates) explicitly stated as a data integrity requirement? [Completeness, Spec §BR-11]
- [ ] CHK026 — Is `updated_by` required to reflect the acting user on every mutation rather than the original creator? [Completeness, Spec §BR-11]
- [ ] CHK027 — Are `ON DELETE SET NULL` semantics on `created_by` and `updated_by` FKs documented as intentional (preserving audit records after user deletion) rather than being a passive default? [Clarity, Spec §Data Model]
- [ ] CHK028 — Are structured logging fields (`correlation_id`, `workspace_id`, `error_code`) specified as mandatory on all handler log emissions, with no sensitive values (tokens, passwords) included? [Completeness, Spec §Non-Functional Requirements]

---

## License & Schema Version Enforcement Requirements

- [ ] CHK029 — Is license middleware enforcement explicitly required on ALL category routes (including read-only GET endpoints) rather than only write operations? [Completeness, Spec §License & Version Enforcement]
- [ ] CHK030 — Are the three license state outcomes (`ACTIVE` → continue; `SOFT_LOCKED` → 423; `ARCHIVED` → 403) specified with exact HTTP status codes and error codes for each route type? [Completeness, Spec §License & Version Enforcement]
- [ ] CHK031 — Is schema version enforcement (reject below `1.14.0` with 409 `SCHEMA_VERSION_MISMATCH`) required on ALL routes including GET endpoints? [Completeness, Spec §License & Version Enforcement]
- [ ] CHK032 — Is the ordered middleware chain (tenant resolver → license middleware → permission middleware → handler) specified as a non-bypassable pipeline, consistent with the Zidney constitutional "no middleware bypass" rule? [Completeness, Spec §Constitutional Compliance Declaration]

---

## Zidney Constitutional Compliance

- [ ] CHK033 — Does the constitutional compliance declaration cover all 10 constitutional rules, and is each backed by a specific implementation detail rather than a generic assertion? [Completeness, Spec §Constitutional Compliance Declaration]
- [ ] CHK034 — Are the constitutional assertions for "no cross-tenant access" and "no direct DB instantiation" operationalized with concrete, verifiable implementation constraints (e.g., must use `c.get('tenant').pool`) rather than aspirational statements? [Measurability, Spec §Constitutional Compliance Declaration]
- [ ] CHK035 — Is "server-authoritative time only" defined in terms of the specific prohibition — `created_at`/`updated_at` never accepted from request body, always set by server? [Clarity, Spec §Constitutional Compliance Declaration]

---

## DoS & Abuse Surface Requirements

- [ ] CHK036 — Are rate limiting requirements defined for category write endpoints (POST, PATCH, DELETE), or is the absence explicitly acknowledged and deferred to platform-level infrastructure? [Gap]
- [ ] CHK037 — Is the hierarchy traversal depth bounded to exactly 3 ancestor hops documented as both a functional constraint (BR-03) and a DoS-prevention bound (no unbounded recursion)? [Completeness, Spec §BR-03]
- [ ] CHK038 — Are requirements defined to limit the maximum size or complexity of the tree endpoint response to prevent tenant-scale data dumps via a single unauthenticated GET? [Gap]
