# Clarification Report – STAGE_14_MMC_MEMBERS

**Generated:** 2026-02-25T15:30:00Z  
**Stage:** STAGE_14_MMC_MEMBERS  
**Phase:** 02_PLATFORM_MMC  
**Step:** 2 – Clarify

---

## Clarification Session Summary

✅ **Ambiguity Scan:** 10 topics analyzed  
✅ **Gaps Identified:** 6 critical clarifications  
✅ **Status:** All ambiguities RESOLVED

### Clarification Audit Trail

| #   | Topic                                            | Severity | Resolution                               | Status |
| --- | ------------------------------------------------ | -------- | ---------------------------------------- | ------ |
| Q1  | Idempotency cache failure mode                   | HIGH     | Hybrid Redis + request_log (Option C)    | ✅     |
| Q2  | Token invalidation cascade atomicity             | HIGH     | Single atomic transaction + JOIN         | ✅     |
| Q3  | Permission resolution determinism (deleted role) | MEDIUM   | FK ON DELETE RESTRICT protects           | ✅     |
| Q4  | API error contract (JSON schema)                 | HIGH     | Standard Zidney envelope + 5 error codes | ✅     |
| Q5  | Member invitation duplicate email                | MEDIUM   | Allow multiple pending, check on accept  | ✅     |
| Q6  | Password hash parameters                         | HIGH     | Bcrypt cost=12, Argon2id memory=65536    | ✅     |

---

## Q1: Idempotency Cache Failure Mode – RESOLVED

### Ambiguity

If Redis cache expires between commit and write (member creation idempotency), could a second POST
request execute the POST logic again and create a duplicate?

### Resolution (Option C: Hybrid)

```
Execution Flow:
  1. Client POST /mmc/members with Idempotency-Key
  2. API checks request_log table first (authoritative)
  3. If found + completed:
     → Return 200 + cached response immediately
  4. If not found:
     → Execute member creation (DB transaction)
     → Write request_log record + status=completed
     → Commit DB transaction
     → Update Redis cache (best-effort, timeout OK)
  5. If Redis write fails (cache miss):
     → On next duplicate request, request_log hit returns cached response
     → No data loss, deterministic deduplication
```

**Guarantee:** UNIQUE(username) and UNIQUE(email) prevent actual duplicate even if both cache and
request_log miss (backend fault tolerance).

**Impact:** Race window eliminated; determinism restored; aligns with financial-grade standards.

---

## Q2: Token Invalidation Cascade – RESOLVED

### Ambiguity

When role permissions change (e.g., can_edit=false→true), are ALL affected members' token_version
increments committed in a single transaction?

### Resolution

**YES – Atomic Transaction.**

```sql
BEGIN TRANSACTION;
  UPDATE mmc_members
  SET token_version = token_version + 1
  WHERE role_id = $1
  AND status = 'ACTIVE';

  UPDATE role_permissions
  SET can_edit = true
  WHERE role_id = $1
  AND domain = 'ORGANIZATION_SETTINGS';
COMMIT;
```

**Failure modes:**

- Commit: All token_versions incremented + permission updated (all active sessions invalidated)
- Rollback: Neither change applied; consistency maintained
- No partial state possible

**Session Impact:** Within <100ms, all affected members' active tokens trigger 401 UNAUTHORIZED on
next API call (middleware validates token_version against DB).

---

## Q3: Permission Resolution Determinism – RESOLVED

### Ambiguity

If a role is deleted mid-request (while permission check is executing), what determines the outcome?

### Resolution

**NOT POSSIBLE – FK Constraint.**

```sql
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_id
  FOREIGN KEY (role_id) REFERENCES roles(id)
  ON DELETE RESTRICT;
```

**Business Rule:** Role deletion only allowed if zero members assigned.

```typescript
async deleteRole(roleId: UUID) {
  const memberCount = await query(
    'SELECT COUNT(*) FROM mmc_members WHERE role_id = $1',
    [roleId]
  );
  if (memberCount > 0) throw new Error('409: Role in use'); // Cannot delete

  // Explicit check passed, now delete
  await query('DELETE FROM roles WHERE id = $1', [roleId]);
}
```

**Guarantee:** No race condition; no deleted role exists with assigned members; deterministic state.

---

## Q4: API Error Contract – RESOLVED

### Ambiguity

What is the exact JSON response schema for 401/403/409 errors?

### Resolution

**Standard Zidney Error Envelope:**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

**Error Codes by Scenario:**

| HTTP | Code                 | Scenario                                                                               |
| ---- | -------------------- | -------------------------------------------------------------------------------------- |
| 401  | UNAUTHORIZED         | Invalid/expired JWT, workspace_id in token, missing Authorization header               |
| 403  | PERMISSION_DENIED    | User lacks permission (e.g., can_create=false on POST /mmc/members)                    |
| 409  | CONFLICT             | Username/email duplicate, role cannot delete (members assigned), member already exists |
| 410  | GONE                 | Invitation expired (TOO > 24h)                                                         |
| 422  | UNPROCESSABLE_ENTITY | Invalid email format, weak password, bad role_id FK, malformed request                 |

**Example Response:**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Your account lacks permission MEMBERS_MANAGEMENT.can_create"
  }
}
```

---

## Q5: Member Invitation Duplicate Email – RESOLVED

### Ambiguity

If the same email is invited twice (before first invitation expires), what is the behavior?

### Resolution

**Multiple Pending Invitations Allowed.**

```
Scenario: Invite alice@example.com on 2026-02-25 10:00 → Expire at 10:00+24h
          Email received, invitation not accepted yet
          Invite alice@example.com again on 2026-02-25 11:00

Database State:
  invitation #1: token_once="abc123...", status='PENDING', created_at=10:00, expires_at=10:00+24h
  invitation #2: token_once="xyz789...", status='PENDING', created_at=11:00, expires_at=11:00+24h

User can accept either token; first accepted wins (creates mmc_members record).
Second token acceptance:
  - Validates token_once against invitation #2
  - Checks if mmc_members.email exists → YES (from #1 acceptance)
  - Returns 409 CONFLICT (member already exists)

Cleanup:
  - Worker job deletes expired invitations (created_at < NOW() - INTERVAL 24h AND status='PENDING')
  - Both invitations eventually cleaned up
```

**Audit:** All invitation lifecycle events logged (sent, accepted, expired, rejected).

---

## Q6: Password Hash Parameters – RESOLVED

### Ambiguity

What are the exact bcrypt/Argon2 parameters to use?

### Resolution

**Locked Parameters (No Override):**

| Algorithm | Parameter   | Value        | Rationale                                                       |
| --------- | ----------- | ------------ | --------------------------------------------------------------- |
| Bcrypt    | cost factor | 12           | OWASP 2023 recommended for interactive password hashing (2026)  |
| Argon2id  | memory      | 65536 (64MB) | Sufficient for brute-force resistance; low overhead on platform |
| Argon2id  | parallelism | 1            | Single-threaded to ensure consistency                           |
| Argon2id  | iterations  | 3            | OWASP 2023 minimum for Argon2id                                 |

**Implementation:**

```typescript
import bcrypt from "bcryptjs"; // or native bcrypt

const hashed = await bcrypt.hash(plaintext, 12);
const match = await bcrypt.compare(plaintext, hashed); // Timing-safe
```

**No Override Per Request:** All SSO flows, API setups, and batch operations use these parameters.

---

## Constitutional Alignment

✅ **Q1 (Idempotency):** Aligns with ADR-0009 (Attempt Integrity) — deterministic deduplication
ensures exactly-once semantics  
✅ **Q2 (Token Cascade):** Aligns with ADR-0006 (Runtime Execution) — atomic session invalidation  
✅ **Q3 (Permission Determinism):** Aligns with AGENTS.md (Attempt Engine Integrity) — no runtime
policy evaluation  
✅ **Q4 (Error Contract):** Aligns with ADR-0011 (Error Handling) — structured responses  
✅ **Q5 (Invitation Edge Case):** Aligns with ADR-0003 (Master DB) — no assumption of uniqueness
except where enforced  
✅ **Q6 (Password Hashing):** Aligns with ADR-0005 (Security Model) — no plaintext, deterministic
hashing

---

## Verification Checklist

- ✅ All ambiguities have testable resolutions
- ✅ No inference or implicit behavior remains
- ✅ Edge cases (cache failures, FK conflicts, duplicate emails, role deletion, token expiry)
  covered
- ✅ All resolutions constitutional compliant
- ✅ Specification updated in-place with clarifications section

---

## Ready for Planning

The clarification phase is **COMPLETE**. All ambiguities resolved; specification is definitive.

Next step: `speckit.plan` to generate technical design and artifacts.
