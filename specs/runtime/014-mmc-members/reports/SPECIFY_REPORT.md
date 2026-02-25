# Specification Report – STAGE_14_MMC_MEMBERS

**Generated:** 2026-02-25T15:15:00Z  
**Stage:** STAGE_14_MMC_MEMBERS  
**Phase:** 02_PLATFORM_MMC  
**Step:** 1 – Specify

---

## Specification Completion Summary

✅ **Specification:** specs/runtime/014-mmc-members/spec.md  
✅ **Quality Checklist:** specs/runtime/014-mmc-members/checklists/requirements.md

### Document Stats

- **Lines:** 1,300+
- **Sections:** 14
- **Data Tables Defined:** 5 (mmc_members, roles, role_permissions, mmc_member_invitations, mmc_audit_log)
- **Atomic Operations:** 6
- **User Flows:** 4
- **Requirements:** 10 (F1-F10)
- **Success Criteria:** 5 measurable criteria

---

## Constitutional Compliance

✅ All isolation rules verified:

- MMC scoped to master_db ONLY
- No tenant resolver instantiation
- No cross-tenant joins
- Version compatibility enforced
- Server-authoritative time only
- Structured logging with correlation_id

✅ RBAC model confirmed:

- One user → One role (no multi-role in Phase 2)
- One role → Many permissions
- 7 permission domains defined
- Deterministic resolution (table lookup, no runtime evaluation)

---

## Key Design Decisions

1. **Token Version Invalidation Strategy**
   - Role changes or member disablement increments token_version
   - Auth middleware rejects outdated tokens
   - Cascades invalidation across all member sessions

2. **Atomic Cascade Operations**
   - All role permission updates atomically increment token_version for affected members
   - Ensures consistency without polling

3. **Invitations System**
   - 24-hour TTL enforced server-side
   - Single-use tokens
   - Audit trail of all invitations

4. **Immutable Audit Trail**
   - mmc_audit_log is append-only
   - Records every permission change
   - Never updated or deleted

---

## Data Model Highlights

### mmc_members Table

- id (UUID)
- username (unique, immutable)
- email (unique)
- password_hash (Argon2/bcrypt)
- role_id (FK → roles.id)
- team_id, group_id, department_id (nullable)
- token_version (integer)
- status (ACTIVE | DISABLED)

### role_permissions Table

- role_id (FK)
- domain (enum: 7 domains)
- can_view, can_create, can_edit, can_delete (booleans)
- Missing permission row = deny by default

---

## Permission Domains

1. ORGANIZATION_SETTINGS
2. PRODUCT_MANAGEMENT
3. LICENSE_MANAGEMENT
4. CLIENT_MANAGEMENT
5. AFFILIATE_MANAGEMENT
6. MEMBERS_MANAGEMENT
7. REPORTING

---

## Rate Limiting Strategy

- **Login:** 5 attempts/minute per IP
- **Member Creation:** 10 requests/minute
- **Other Operations:** 20-60 requests/minute (role-dependent)

---

## Security Boundaries

✅ **No plaintext secrets** in logs
✅ **Password hashing** enforced (Argon2/bcrypt)
✅ **Permission enforcement** at API layer (not frontend)
✅ **Audit logging** for all state changes
✅ **Token invalidation** cascades
✅ **JWT isolation** (MMC tokens rejected at tenant API)

---

## Success Criteria from Specification

1. **Onboarding Time:** ≤ 5 minutes for end-user signup via invitation
2. **Role Application:** < 30 seconds from role change to new permissions active
3. **Performance:** p95 latency ≤ 500ms for permission checks
4. **Audit Completeness:** 100% of state changes logged
5. **Deterministic Resolution:** All permission lookups match role definition (zero inference)

---

## Next Steps

The specification is **READY FOR PLANNING** via `speckit.plan`.

All ambiguities resolved, constraints verified, and requirements testable.

No implementation details leak into specification.
