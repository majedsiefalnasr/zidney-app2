# Tenant Isolation Requirements Checklist: Tags (STAGE 32)

**Purpose**: Validate that tenant isolation and license enforcement requirements are complete, unambiguous, and ready for implementation  
**Created**: 2026-03-23  
**Feature**: [spec.md](../spec.md)  
**Stage**: `STAGE_32_TAGS`  
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`

---

## Database Isolation Requirements

- [ ] CHK001 - Are `tags` and `tag_relations` specified as residing exclusively in the tenant DB (never in a shared or global DB)? [Completeness, Spec §FR-020, Isolation Impact Analysis]
- [ ] CHK002 - Is the explicit prohibition on a global shared `tags` table stated as a hard rule in the spec? [Completeness, Spec §FR-020]
- [ ] CHK003 - Is the tenant DB resolver designated as the ONLY permitted path for obtaining a DB connection for any tag operation (no global singleton allowed)? [Completeness, Spec §Isolation Impact Analysis, Constitutional Compliance]
- [ ] CHK004 - Is cross-tenant visibility or access of tags and `tag_relations` rows explicitly prohibited? [Completeness, Spec §FR-019]
- [ ] CHK005 - Are the `tags` and `tag_relations` tables confirmed as tenant-DB-scoped in the migration specification and test requirements? [Completeness, Spec §Data Model, Test Requirements §Migration Tests]

---

## Tenant Resolver & Middleware Chain Requirements

- [ ] CHK006 - Is the tenant resolver specified as mandatory on ALL tag and tag-relation API routes, with no exceptions permitted? [Completeness, Spec §FR-014]
- [ ] CHK007 - Is the required middleware execution order (tenant resolver → license middleware → permission check → handler) explicitly stated for all tag route groups? [Completeness, Spec §API Endpoints]
- [ ] CHK008 - Is it unambiguously stated that no route handler may access the DB before both tenant and license validation have completed? [Completeness, Spec §Isolation Impact Analysis]
- [ ] CHK009 - Is the slug/subdomain-based tenant resolution mechanism described, so that the correct tenant DB is resolved before any tag query executes? [Completeness, Spec §Isolation Impact Analysis]
- [ ] CHK010 - Is the requirement to enforce tenant scope at the resolver level (before permission checks) stated for all tag routes? [Completeness, Spec §Access Control]

---

## License Enforcement Requirements

- [ ] CHK011 - Is the license middleware requirement explicitly stated for all tag management routes (`POST /tags`, `GET /tags`, `GET /tags/:id`, `PATCH /tags/:id`, `DELETE /tags/:id`)? [Completeness, Spec §FR-014, License & Version Enforcement]
- [ ] CHK012 - Is the license middleware requirement explicitly stated for tag assignment routes (`POST /tag-relations`, `DELETE /tag-relations/:id`) and entity-tag read routes? [Completeness, Spec §FR-014]
- [ ] CHK013 - Are all three license-failure response states (`SOFT_LOCKED → 423 Locked`, `ARCHIVED → 403 Forbidden`, `NOT_FOUND → 404 Not Found`) specified with their exact HTTP status codes? [Completeness, Spec §License & Version Enforcement]
- [ ] CHK014 - Is the `ACTIVE`-only license requirement stated for all workspace tag routes, such that `SOFT_LOCKED` and `ARCHIVED` tenants are blocked? [Completeness, Spec §License & Version Enforcement]
- [ ] CHK015 - Is `schema_version` compatibility enforcement specified as a runtime requirement (incompatible tenants are rejected before tag logic executes)? [Completeness, Spec §License & Version Enforcement]
- [ ] CHK016 - Is `product_version` enforcement at the request boundary documented as a mandatory requirement for this stage? [Completeness, Spec §License & Version Enforcement]

---

## Cross-Tenant Prohibition Requirements

- [ ] CHK017 - Is the prohibition on `tag_id` values from one tenant's DB being referenced or accessible from another tenant's context stated? [Completeness, Spec §FR-019]
- [ ] CHK018 - Is tenant isolation for tag-based filtering queries (multi-tag AND filter) specified — i.e., filtering operates only within the resolved tenant DB and can never span tenants? [Completeness, Spec §FR-012, FR-019]
- [ ] CHK019 - Is the tenant isolation integration test requirement (tag created in tenant A must not be visible via tenant B's resolver) included in the spec's Test Requirements? [Completeness, Spec §Test Requirements §Integration Tests]
- [ ] CHK020 - Is the requirement that the connection pool for tag DB access is tenant-scoped (per-tenant in-memory pool map, not a shared global pool) documented? [Completeness, Spec §Isolation Impact Analysis]

---

## Constitutional Compliance

- [ ] CHK021 - Has the Constitutional Compliance Declaration been completed for all isolation-relevant rules: no cross-tenant access, no middleware bypass, no global DB singleton, no direct DB instantiation? [Completeness, Spec §Constitutional Compliance]
- [ ] CHK022 - Is the absence of any division-boundary or department-isolation interaction for tags explicitly documented in the Constitutional Compliance table? [Completeness, Spec §Constitutional Compliance]

---

## Notes

- Items marked `[Gap]` require requirements to be added or explicitly declared out of scope before implementation proceeds.
- CHK006–CHK016 collectively gate the "License middleware applied on all tag routes" mandatory requirement from the request.
- CHK001–CHK005 collectively gate the "all tag operations use tenant DB resolver; no cross-tenant references" mandatory requirement.
