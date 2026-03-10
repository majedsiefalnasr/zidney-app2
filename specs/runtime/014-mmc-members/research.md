# Research & Architecture Decisions — STAGE_14_MMC_MEMBERS

## Executive Summary

This document captures architectural research and decisions for the MMC Members & RBAC system. All
clarifications from spec.md are resolved with explicit rationale and alternative analysis.

---

## Decision 1: Master DB Scope Only (No Tenant Resolver)

### Question

Why does MMC operate exclusively in `master_db` without tenant resolver middleware?

### Decision

**All MMC operations scoped to master_db only. No resolver injection in MMC routes.**

### Rationale

1. **Architectural Separation:**
   - MMC is platform control layer, not tenant runtime
   - Tenant resolver exists to isolate tenant data; MMC has no tenant context
   - Forcing resolver would create artificial workspace_id in MMC context

2. **Trust Chain Integrity:**
   - Trust chain: Isolation → License → Auth → Attempt → Runtime → Frontoffice
   - MMC operates at Isolation level (before tenant context)
   - Resolver operates at Attempt/Runtime level (after tenant context)
   - Layering violation if resolver injected into MMC routes

3. **Security Boundary:**
   - MMC tokens MUST be rejected by tenant endpoints (401 if workspace_id detected)
   - Tenant tokens MUST be rejected by MMC endpoints (401 if workspace_id present)
   - Cross-context token reuse is principal attack vector; resolver isolation prevents this

4. **Query Simplicity:**
   - MMC queries: `SELECT * FROM master_db.mmc_members WHERE id = ?`
   - No scope filtering needed (only one "workspace" = platform itself)
   - Simpler = fewer security surface areas

### Alternatives Considered

| Alternative                     | Rejected Because                                          | Trade-off                                                             |
| ------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| Row-based MMC in tenant_db      | Breaks isolation; cross-tenant management possible        | Would require global super-admin tenant; violates database-per-tenant |
| Resolver + workspace_id for MMC | Creates artificial MMC "workspace"; confuses architecture | Adds cognitive load; "which workspace is admin in?" question appears  |
| Global DB singleton for MMC     | No pooling; connection leak risk                          | Degrades observability; cannot bind to correlation_id                 |

### Implementation Consequence

- MMC routes import `master_db` directly (not via resolver)
- MMC routes have implicit `master_db` context (no parameter injection)
- Linter enforces: `apps/api/src/mmc/*` may not import tenant resolver
- Type system prevents tenant pool injection into MMC middleware stack

---

## Decision 2: RBAC Only, No ABAC (Phase 2 Scope)

### Question

Why deterministic RBAC instead of dynamic/attribute-based access control?

### Decision

**Phase 2 implements role-based access control only. No runtime policy evaluation, no
attribute-based decisions.**

### Rationale

1. **Determinism & Auditability:**
   - RBAC: Permission = row in role_permissions table (deterministic, queryable)
   - ABAC: Permission = runtime policy evaluation (indeterminate, harder to audit)
   - Audit trail easier with RBAC: "user had X permission because role = Y"

2. **Operational Simplicity:**
   - 7 domains × 4 permissions = 28 total policies to manage
   - Fits in single `role_permissions` table lookup
   - ABAC with attributes would require: user attributes + resource attributes + policy language
     interpreter

3. **Performance Guarantees:**
   - RBAC permission check: O(1) table lookup (one row per domain per role)
   - ABAC: O(n) policy evaluation + potential external system calls
   - MMC endpoints must maintain < 500ms p95; RBAC guarantees this

4. **Security: Explicit > Implicit**
   - Missing row in role_permissions = DENY (fail-safe)
   - No super-admin bypass through policy bug
   - Permission matrix visible in code review

### Alternatives Considered

| Alternative                    | Rejected Because                                             | Trade-off                                                           |
| ------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| ABAC with attributes           | Phase 2 scope constraints; over-engineered for current needs | Would require attribute schema + policy engine; deferred to Phase 3 |
| Hard-coded permissions in code | Violates "no business logic in code"; breaks auditability    | Cannot edit permissions without code deploy                         |
| Implicit super-admin           | Violates "no bypass" rule; audit failures possible           | Would enable privilege escalation vectors                           |

### Implementation Consequence

- Domain validation: exactly 7 domains (enum in code + CHECK constraint in DB)
- Permission bits: can_view, can_create, can_edit, can_delete (4 booleans)
- Permission resolution: `role_permissions` table lookup only
- No runtime policy language needed

---

## Decision 3: Token Version Cascade (vs. Polling/Webhooks)

### Question

Why use `token_version` increment for session invalidation instead of polling or webhooks?

### Decision

**Token version cascade: atomic increment broadcasts to all affected sessions via next-request
check.**

### Rationale

1. **Atomic Broadcast Without Infrastructure:**
   - No message queue needed (Redis already available for idempotency cache)
   - No webhook callbacks to manage
   - No polling overhead on client

2. **Immediate Effective Scope:**
   - Role change: all members with that role get new token_version in single transaction
   - Next request from any member: middleware detects mismatch, forces re-auth
   - Guaranteed invalidation within request latency (typically <100ms distributed)

3. **Compatibility with Distributed Deployment:**
   - No centralized session store needed
   - Token-as-document model: JWT contains token_version at issue time
   - Next request compares JWT.token_version with DB mmc_members.token_version
   - Works identically whether multiple API instances or single instance

4. **Simplicity Over Sophistication:**
   - Polling: client must periodically check; adds latency
   - Webhooks: requires callback URL management; operational complexity
   - Token version: check always happens on next request anyway; zero additional infrastructure

### Alternatives Considered

| Alternative                | Rejected Because                                                                   | Trade-off                                                       |
| -------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Redis pub/sub invalidation | No client-side socket available in browser; would require WebSocket infrastructure | Adds operational complexity; not justified for Phase 2          |
| Database polling           | Client polls to check if token valid; inefficient, adds DB load                    | Doesn't reduce latency; increases queries                       |
| JWT expiration shortening  | Shorten JWT TTL to minutes; role changes effective in minutes                      | Acceptable for Phase 2, but less immediate than version cascade |

### Implementation Consequence

- Membership in mmc_members table: `token_version INTEGER DEFAULT 1`
- JWT payload at issue: `token_version: 1`
- Middleware on every request: `IF jwt.token_version != db.token_version THEN 401`
- Role edit transaction:
  `UPDATE mmc_members SET token_version = token_version + 1 WHERE role_id = ?`
- Member disable transaction:
  `UPDATE mmc_members SET token_version = token_version + 1 WHERE id = ?`

---

## Decision 4: Hybrid Idempotency (Redis + Request Log Fallback)

### Question

Why use both Redis cache AND database request log for idempotency? Why not just one?

### Decision

**Hybrid: Redis fast path (24h TTL) with database fallback (true source of truth).**

### Rationale

1. **Redis Primary (Fast Path):**
   - Key: `mmc:idempotency:{idempotency_key}`
   - Value: API response JSON (200-level status only)
   - TTL: 24 hours
   - Lookup time: <5ms (compared to DB query ~30ms)
   - If hit: return immediate response, no DB work

2. **Database Fallback (Reliability):**
   - Redis failure scenario: if Redis unavailable, idempotency check must still work
   - Fallback table: `request_log` (userId, idempotencyKey, responseBody, createdAt)
   - Fallback lookup: `SELECT response FROM request_log WHERE user_id = ? AND idempotency_key = ?`
   - UNIQUE(user_id, idempotency_key) prevents duplicates even in fallback

3. **Eventual Consistency:**
   - First request: execute, write to Redis, write to DB request_log
   - Near-identical retry: hit Redis, return immediately
   - After Redis eviction (24h): fallback to DB query
   - After DB cleanup (30 days): new request ID required

4. **Prevents Double-Charge in Both Scenarios:**
   - Redis hit: response served from cache; no re-execution
   - DB hit: response serialized from stored response; no re-execution
   - Redis miss + DB miss: fresh execution (legitimate new request)

### Alternatives Considered

| Alternative              | Rejected Because                                              | Trade-off                                                                   |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Redis-only               | No fallback if Redis fails; idempotency lost on crash         | Simpler code; acceptable if Redis is HA; but Phase 2 lacks Redis redundancy |
| Database-only            | Every idempotency check is DB query (30ms); kills performance | More reliable; slower (benchmark: ~6x slower than Redis)                    |
| Distributed lock (Redis) | Prevents concurrent submissions; degrades UX if slow network  | Adds operational complexity; not needed if capture phase is fast enough     |

### Implementation Consequence

- Idempotency key header: `Idempotency-Key: UUID` (required for POST/PUT operations)
- Redis write on success: `SET mmc:idempotency:{key} {response_json} EX 86400`
- Database table `request_log`: userId, idempotency_key, response, created_at
- Middleware: check Redis first, then DB, then execute, then store both
- Cleanup: daily job to expire request_log entries > 30 days old

---

## Decision 5: Bcrypt Cost=12 (OWASP Justification)

### Question

Why bcrypt cost=12 instead of cost=10 or Argon2?

### Decision

**Bcrypt rounds=12 (cost factor). Argon2 acceptable alternative if library pre-installed.**

### Rationale

1. **OWASP 2023 Password Storage Recommendation:**
   - Bcrypt: rounds ≥ 12 (cost ≥ 4^12 = 16 million operations)
   - Cost=12 takes ~200ms on modern hardware to verify (acceptable for login)
   - Cost=10 takes ~50ms (too fast; GPU brute-force reduces attacker computation by ~8x)

2. **Widely Supported:**
   - Bun + Node have mature bcrypt bindings (bcryptjs, better-bcrypt)
   - No additional dependencies beyond standard security library stack
   - Trusted implementation (pyca/bcrypt used by Django, Flask, Werkzeug)

3. **Phase 2 Scope:**
   - Argon2 would be better (resistant to GPU/ASIC attacks), but adds dependency
   - Bcrypt sufficient for MMC (small user base; internal operations)
   - Can upgrade to Argon2 in Phase 3 without breaking existing hashes (backwards compat)

4. **Hardware Baseline:**
   - Cost=12 on 2024 CPU: ~200ms verification
   - Cost=12 on GPU: still ~2B operations; not economically viable to attack full table
   - Cost=12 resists future hardware improvements (halving every ~1.5 years means cost=12 stays
     expensive for 10+ years)

### Alternatives Considered

| Alternative | Rejected Because                                                       | Trade-off                                                       |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Cost=10     | OWASP recommends ≥12; cost=10 halves brute-force difficulty            | Faster login (100ms vs 200ms); security loss not justified      |
| Cost=14     | Verification time ~800ms; user experience degrades (multi-second wait) | More secure; operationally worse; not required for internal MMC |
| Argon2      | Not in assumed dependencies list; may not be pre-installed             | Better security; adds dependency; deferred to Phase 3           |
| PBKDF2      | Weaker than bcrypt to GPU attacks; OWASP less preferred                | Faster; not recommended by OWASP for new systems                |

### Implementation Consequence

- Password hash at creation: `bcrypt.hash(password, 12)`
- Password validation at login: `bcrypt.compare(providedPassword, storedHash)`
- Never store plaintext password
- Never log password or hash
- Login endpoint: POST /mmc/auth/login (not scoped to specific MMC route pattern)

---

## Decision 6: 24-Hour Invitation TTL (No Environment Customization Phase 2)

### Question

Why 24-hour invitation expiration? Why not customizable per environment?

### Decision

**24-hour TTL hard-coded. No environment customization in Phase 2.**

### Rationale

1. **Balance Convenience & Security:**
   - 24h: user can accept within business day
   - 24h: old links naturally expire; reduces phishing window
   - Longer (7d): forgotten links could be clicked weeks later by accident
   - Shorter (1h): users rush; higher support burden

2. **Phase 2 Scope Constraint:**
   - Customizable TTL requires: environment config + migration + admin panel edit
   - Not justified until multi-organization use case requires different policies
   - When Phase 3 adds multi-org, can add customizable TTL per org

3. **Security Posture:**
   - Fixed TTL in code is reviewable and auditable
   - Config-driven TTL could be accidentally set to 30d; harder to catch in review
   - Once invitation expires, never accepted; old invitations are false signals in audit log

4. **Implementation Simplicity:**
   - Hard-coded: `expires_at = NOW() + INTERVAL '24 hours'`
   - No database column for `invitation_ttl_hours`
   - No environment variable lookup; no config passing

### Alternatives Considered

| Alternative                  | Rejected Because                                             | Trade-off                                                    |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Customizable via environment | Phase 2 has no need; adds code path for future feature       | Deferred to Phase 3; implement when use case exists          |
| 1-hour TTL                   | Users feel rushed; support burden increases                  | Higher security; worse UX; not justified                     |
| 7-day TTL                    | Aged links lie in DB; phishing window increases              | Better UX; security degradation; not justified               |
| Expiration job (cleanup)     | Adds background task; not justified for single-stage rollout | Expired invitations can exist in DB indefinitely; acceptable |

### Implementation Consequence

- Invitation creation: `expires_at = NOW() + INTERVAL '24 hours'` (hardcoded in code)
- Acceptance validation:
  `SELECT * FROM mmc_member_invitations WHERE token_hash = ? AND status = 'PENDING' AND expires_at > NOW()`
- Expired invitations never cleaned up (acceptable; they're audit proof)
- No configuration table for TTL settings

---

## Resolved Clarifications Summary

| #   | Clarification           | Resolution                                                             |
| --- | ----------------------- | ---------------------------------------------------------------------- |
| 1   | Master DB scope only    | Architectural boundary; resolver bypass justified by isolation layer   |
| 2   | RBAC vs ABAC            | RBAC only; deterministic, auditable, performant; ABAC deferred Phase 3 |
| 3   | Token version broadcast | Atomic cascade via next-request check; no infrastructure overhead      |
| 4   | Idempotency strategy    | Hybrid Redis+DB; fast path with reliability fallback                   |
| 5   | Password hashing        | Bcrypt cost=12; OWASP 2023 baseline; ~200ms acceptable for login       |
| 6   | Invitation TTL          | 24 hours hardcoded; no environment customization in Phase 2            |

---

## Compliance Alignment

### Constitution Checks

✓ **Database-Per-Tenant Isolation:**

- MMC in master_db only
- No row-based pollution
- No cross-tenant joins
- Master context explicitly isolated via resolver bypass

✓ **Middleware Authority:**

- No route bypasses auth
- Correlation ID propagated to all logs
- Permission enforcement happens before business logic
- Token version checked on every request

✓ **Snapshot-Based Integrity:**

- Not applicable to MMC (no exam logic)
- Audit snapshot captures permission state changes

✓ **Versioned Evolution:**

- Master schema versioned globally once
- Migration enforced transactionally
- No silent auto-upgrades

✓ **Authoritative Server Time:**

- All timestamps from server (NOW() in SQL)
- No client-time trust
- Token_version cascade time-independent

---

## Next Phase Considerations

### Phase 3 Readiness

1. **ABAC Extension:** When multi-organization needs separate policies per org
2. **Tenant-Aware RBAC:** If tenant admins need to manage their own member roles
3. **Argon2 Upgrade:** When password library dependency expanded
4. **Custom TTL:** When organizations request different invitation windows
5. **OAuth/SAML:** When SSO integration required for MMC

### Forward Compatibility

- table schema: no breaking changes planned
- API contracts: versioned by semantic versioning (breaking changes = major bump)
- Permission domains: adding new domain requires schema migration (no breaking)
- Audit log: append-only; retro-analysis compatible with new action types

---

## References

- OWASP Password Storage Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Bcrypt Wikipedia: https://en.wikipedia.org/wiki/Bcrypt
- ADR-0001: Database-per-tenant isolation
- ADR-0003: Master DB schema
- ADR-0006: Runtime authoritative time
- Constitution § Database-Per-Tenant Isolation
- Constitution § Middleware Authority
