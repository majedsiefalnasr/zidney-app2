# Clarification Analysis – Authentication System (STAGE_03)

**Stage:** STAGE_03_AUTHENTICATION_SYSTEM  
**Phase:** 1 – Platform Foundation  
**Last Updated:** 2024-02-17  
**Status:** Ready for Planning

---

## Audit Framework

This clarification follows the SpecKit Hard Mode Clarify Phase mandate. It audits ambiguities across 8 critical areas:

1. **Transactions** — Atomicity, ACID guarantees, rollback paths
2. **Idempotency** — Replay safety, duplicate handling
3. **Concurrency** — Race conditions, serialization, locks
4. **Version Enforcement** — Schema compat, product version compatibility
5. **Middleware Enforcement** — Order, mandatory steps, bypass prevention
6. **Security Validation** — Input sanitization, token validation
7. **Error Contract** — HTTP codes, error structure, consistency
8. **Isolation Boundaries** — Workspace scoping, cross-domain rejection

---

## 1. TRANSACTIONS

### Question 1.1: Login Transaction Isolation Level

**Ambiguity:** What PostgreSQL isolation level is required for login transaction?

**Specification Say:** "Atomic transaction with row lock"

**Clarification Required:**

- SERIALIZABLE (strictest): Prevents phantom reads, highest conflict rate
- REPEATABLE READ (recommended): Prevents dirty reads, non-repeatable reads
- READ COMMITTED (weakest): Default PostgreSQL, sufficient for password checks

**Resolution:**
$$\boxed{\text{REPEATABLE READ}}$$

- Password verification must be deterministic (same input → same result)
- Row lock (FOR UPDATE) provides serialization for token_version
- Prevents lost updates on failed_attempts counter
- Sufficient for Phase 1 (not financial transactions)

**Implication:** Set transaction isolation_level = REPEATABLE READ on login transaction.

---

### Question 1.2: Failed Login Tracking Transaction

**Ambiguity:** Should failed login insertion be in same transaction as account lock check?

**Specification Say:** "Atomic transaction" but unclear if it's one or two transactions.

**Clarification Required:**

Option A: Single transaction

```sql
BEGIN TRANSACTION
  1. INSERT login_attempts
  2. COUNT failures
  3. LOCK account if needed
COMMIT
```

Option B: Two transactions (insert then check)

```sql
BEGIN → INSERT login_attempts → COMMIT
BEGIN → COUNT → LOCK → COMMIT
```

**Resolution:**
$$\boxed{\text{Option A: Single transaction}}$$

**Rationale:**

- Prevents lost updates on lock counter
- Ensures atomicity: Either all updates succeed or none
- Failed login insert must not succeed while lock fails
- If insert succeeds but lock fails, inconsistency occurs

**Implication:** login_attempts INSERT must be in same SERIALIZABLE transaction as account lock update.

---

### Question 1.3: Rollback on Token Generation Failure

**Ambiguity:** If JWT signing fails inside login transaction, what happens?

**Specification Say:** "Transaction rollback" but doesn't specify scope.

**Clarification Required:** Should we rollback:

- (A) Just the JWT generation → re-try signing, user retry
- (B) Entire login transaction → no side effects, clean rollback
- (C) Partial rollback → insert audit log before rollback

**Resolution:**
$$\boxed{\text{Option B: Full rollback}}$$

**Flow:**

```sql
BEGIN TRANSACTION
  1. Validate user
  2. Check license
  3. Generate JWT (may fail if signing lib crashes)
CATCH (error)
  → ROLLBACK entire transaction
  → Return 500 Internal Server Error
  → NO audit log (transaction rolled back)
ENDIF
```

**Rationale:**

- Password check succeeds but JWT signing fails = error state
- Rollback doesn't lose data (auth tables untouched)
- Audit log insertion part of transaction
- User can retry login

**Implication:** JWT generation is last step in login transaction. If it fails, ROLLBACK includes audit log, meaning user sees 500 without event logged. Consider moving audit log insert AFTER COMMIT for non-failure cases.

---

### Question 1.4: Token Version Increment Race Condition

**Ambiguity:** Can two logout-all requests race and produce inconsistent token_version?

**Specification Say:** "BEGIN TRANSACTION, INCREMENT token_version, COMMIT"

**Clarification Required:** With REPEATABLE READ isolation:

Thread 1: SELECT token_version = 5
Thread 2: SELECT token_version = 5
Thread 1: UPDATE token_version = 6, COMMIT
Thread 2: UPDATE token_version = 6, COMMIT ← RACE!

**Resolution:**
$$\boxed{\text{Use FOR UPDATE to serialize}}$$

**Corrected Flow:**

```sql
BEGIN TRANSACTION (SERIALIZABLE or REPEATABLE READ)
  1. SELECT user WHERE id = $1 FOR UPDATE  -- Row lock acquired
  2. Read token_version (guaranteed current due to lock)
  3. Increment and update
  4. COMMIT (lock released)
```

**With FOR UPDATE:** Thread 2 blocks until Thread 1 commits, then reads updated value. No race.

**Implication:** Logout-all (token version increment) MUST use FOR UPDATE lock. Update spec to clarify this.

---

## 2. IDEMPOTENCY

### Question 2.1: Login Idempotency Boundary

**Ambiguity:** Spec says login is "not idempotent" but is token generation truly safe to repeat?

**Specification Say:** "Multiple calls = multiple unique tokens, acceptable"

**Clarification Required:** Can a client safely retry failed login?

Scenario:

- User submits login
- Response starts to send (token generated, DB updated)
- Network fails
- Client retries

**Question:** Does second call get:

- (A) New token (different token_version claim)?
- (B) Same token (idempotent on same timestamp)?
- (C) Error (duplicate detected)?

**Resolution:**
$$\boxed{\text{Option A: New token}}$$

**Reasoning:**

- Tokens are short-lived (15 min)
- No idempotency key in request
- Multiple tokens per session acceptable
- Both tokens valid independently

**Edge case:** If first request succeeded but client didn't receive response, second call creates second valid token. Both work. This is acceptable.

**Implication:** No idempotency guarantee for login. Client is responsible for single-submit via UI. Document this clearly.

---

### Question 2.2: Logout-All Idempotency

**Ambiguity:** Logout-all increments token_version. Is second call truly idempotent?

**Specification Say:** "Idempotent — Second call increments again"

**Clarification Required:** Is "same outcome" really idempotent?

First call: `token_version: 5 → 6`
Second call: `token_version: 6 → 7`

Result: Both calls invalidate all old tokens, but are they truly idempotent?

**Mathematical Definition:** f(f(x)) = f(x)

Here: f(f(5)) = f(6) = 7, but f(5) = 6. NOT idempotent by strict definition.

**Operational Definition:** Same business effect (all old tokens invalid).

**Resolution:**
$$\boxed{\text{Logout-all is NOT strictly idempotent, but outcome-idempotent}}$$

**Clarification to Spec:**

- Logout-all endpoint should be callable multiple times
- Each call increments version again
- Side effect: Old tokens always invalid (operational idempotency)
- Strict mathematical idempotency: **NO**
- Conflict handling: None needed (no idempotency key)

**Implication:** Don't claim "idempotent" — claim "non-destructive replay safe."

---

### Question 2.3: Password Change Idempotency

**Ambiguity:** Specification doesn't address password change. If included, should it be idempotent?

**Clarification Required:**

Scenario: User submits new_password in request with correlation_id.

Option A: Use (user_id, correlation_id) as idempotency key → same hash
Option B: Always hash new_password, let duplicate fail on unique constraint
Option C: Out of scope for Phase 1

**Resolution:**
$$\boxed{\text{Option C: Out of scope for Phase 1}}$$

**Reasoning:** Spec doesn't define password change endpoint. Phase 2+ feature.

**Implication:** Document as explicit non-goal. Don't implement until Phase 2.

---

## 3. CONCURRENCY

### Question 3.1: Concurrent Login from Same Email

**Ambiguity:** Can two users log in with same email simultaneously?

**Specification Say:** "Unique constraint on email" but doesn't specify behavior if concurrent logins succeed.

**Clarification Required:** With constraints:

- unique(email) → one active account
- But what if two requests start before either hits DB?

Thread 1: User@example.com begins login
Thread 2: User@example.com begins login (fast network, arrives before Thread 1 commits)

Result: Both may read password_hash, both verify OK, both generate tokens, both succeed.

**Question:** Is this allowed?

**Resolution:**
$$\boxed{\text{YES - Multiple tokens per user allowed}}$$

**Rationale:**

- Same user logging in from multiple devices/browsers
- Both tokens are valid independently
- Both have same token_version (concurrent reads)
- No conflict — tokens don't interact
- Logout-all handles revocation

**Implication:** Concurrent login from same email creates multiple valid sessions. This is correct. No session singleton required.

---

### Question 3.2: Concurrent Failed Login Attempt Counting

**Ambiguity:** If 5 requests arrive concurrently, all failing, how many lock the account?

**Clarification Required:**

Scenario (REPEATABLE READ isolation):

```
Thread 1-5: Each reads failed_attempts count
Thread 1-5: Each count = 3 (all start together)
Thread 1-5: Each thinks count + 1 = 4 (all under threshold)
All commit successfully → 5 insertions, account not locked
```

**Question:** Is this a problem?

**Resolution:**
$$\boxed{\text{YES - Use SERIALIZABLE or SELECT FOR UPDATE}}$$

**Corrected Flow:**

```sql
BEGIN TRANSACTION (SERIALIZABLE)
  1. SELECT COUNT(*) FROM login_attempts WHERE ... FOR UPDATE (row lock on count)
  2. IF count >= 5:
       UPDATE users SET locked_until = NOW() + 30 minutes
  3. INSERT login_attempts
COMMIT
```

**With SERIALIZABLE:** Thread 2 waits until Thread 1 commits, sees updated count, enforces lock correctly.

**Implication:** Failed login counter needs serialization. Update spec to mandate SERIALIZABLE for failed login path or add explicit row lock.

---

### Question 3.3: Connection Pool Under Concurrent Load

**Ambiguity:** Specification mentions "connection pool per tenant" but doesn't define:

- Pool size?
- Timeout on exhaustion?
- Failure mode?

**Clarification Required:**

Option A: Drizzle default pool (10-20 connections)
Option B: Configurable per workspace
Option C: Specification doesn't mandate

**Resolution:**
$$\boxed{\text{Option A: Drizzle default + configurable override}}$$

**Implication:**

- Phase 1: Use Drizzle default (10-20 per tenant)
- Phase 2: Admin settings for pool size
- DevOps: Monitor pool exhaustion
- Failure: 503 Service Unavailable on pool exhaustion

---

## 4. VERSION ENFORCEMENT

### Question 4.1: Schema Version Bump Granularity

**Ambiguity:** When exactly does schema_version increment?

**Specification Say:** "Schema increment required (MAJOR.MINOR.0+1)" but doesn't define increments per stage or per change.

**Clarification Required:**

Option A: One increment per migration file
Option B: One increment per release
Option C: Specified per stage in migration plan

**Resolution:**
$$\boxed{\text{Option A: One increment per migration file}}$$

**Rationale:**

- Each migration is forward-only change
- Each change may affect token compatibility
- Explicit tracking per change
- Phase 2+: Specify in migration metadata

**Implication:** Migration file includes new schema_version in its up() function.

---

### Question 4.2: Product Version Compatibility Matrix

**Ambiguity:** What does "compatible with" mean for product_version?

**Specification Say:** "Token.product_version incompatible → 426"

**Clarification Required:**

Example matrix:

- Product 2.0.0 token in 2.0.1 runtime → Compatible?
- Product 2.0.0 token in 2.1.0 runtime → Compatible?
- Product 2.0.0 token in 3.0.0 runtime → Compatible?

**Resolution:**
$$\boxed{\text{Use SemVer compatibility rules}}$$

Reference ADR-0008 (Semantic Versioning):

- PATCH bump (2.0.0 → 2.0.1) → Compatible
- MINOR bump (2.0.0 → 2.1.0) → Compatible if no breaking changes
- MAJOR bump (2.0.0 → 3.0.0) → NOT compatible

**Implementation:**

```
Token version: 2.1.3
Runtime version: 2.5.0
Compatibility: major(token) == major(runtime) → YES

Token version: 2.1.3
Runtime version: 3.0.0
Compatibility: major(token) != major(runtime) → NO, 426
```

**Implication:** Add version comparison logic to middleware. Reference ADR-0008 for algorithm.

---

### Question 4.3: Schema Version Minimum Threshold

**Ambiguity:** Specification mentions "minimum_supported_schema_version" but doesn't define how it's set.

**Clarification Required:**

Who decides minimum supported version?

- (A) Operator (manual threshold in platform_settings)
- (B) Code (hardcoded in runtime)
- (C) Automatic (based on latest migration)

**Resolution:**
$$\boxed{\text{Option A: Operator-configurable}}$$

**Implication:**

- Admin can force minimum upgrade: `UPDATE platform_settings SET minimum_supported_schema_version = '2.0.0'`
- Tenants below 2.0.0 receive 426 Upgrade Required
- Forces staggered upgrades if needed

---

## 5. MIDDLEWARE ENFORCEMENT

### Question 5.1: Middleware Execution Order Verification

**Ambiguity:** Specification states middleware order but doesn't specify how to prevent bypasses.

**Specification Say:** "Correlation ID → Tenant Resolver → License Enforcement → Schema Validation → Route"

**Clarification Required:** How to prevent accidental bypass?

Example: Developer adds new endpoint without middleware stack.

**Resolution:**
$$\boxed{\text{Enforce via middleware composition (cannot be bypassed structurally)}}$$

**Implementation Pattern:**

```typescript
const protectedRouter = new Router()
  .use(correlationIdMiddleware)      // 1
  .use(tenantResolverMiddleware)     // 2
  .use(licenseEnforcementMiddleware) // 3
  .use(schemaValidationMiddleware)   // 4;

// All routes added to protectedRouter inherit full stack
protectedRouter.post('/auth/login', ...);
protectedRouter.get('/exams', ...);
```

**Guarantee:** Every route on protectedRouter runs full middleware stack.

**Implication:** Use router composition, not decorators. Document this pattern in implementation guide.

---

### Question 5.2: Correlation ID Generation vs. Extraction

**Ambiguity:** Specification mentions "generate or extract" but doesn't specify priority.

**Clarification Required:**

Option A: Always generate new (ignore request header)
Option B: Use request header if present, else generate
Option C: Extract from header, reject if missing

**Resolution:**
$$\boxed{\text{Option B: Extract if present, else generate}}$$

**Logic:**

```
IF request.headers['x-correlation-id']
  → Use it
  → Validate format (UUID or alphanumeric)
ELSE
  → Generate new UUID
ENDIF
```

**Rationale:**

- Allows tracing across service boundaries
- Client can provide trace ID for debugging
- System generates if client doesn't

---

### Question 5.3: License Middleware Caching

**Ambiguity:** Should license status be cached or always queried fresh?

**Clarification Required:**

Option A: Query every request (100% current, slower)
Option B: Cache 1 minute TTL (stale tolerance, faster)
Option C: Cache in JWT (already happening for product_version)

**Resolution:**
$$\boxed{\text{Option B: Cache 1 minute TTL}}$$

**Logic:**

```
IF license_cache[workspace_id].expires_at > NOW()
  → Use cached status
ELSE
  → Query master_db.licenses
  → Update cache with 1-minute TTL
ENDIF
```

**Implication:**

- License SOFT_LOCK takes ~1 minute to propagate
- Acceptable for Phase 1
- Phase 2: Real-time WebSocket updates

---

## 6. SECURITY VALIDATION

### Question 6.1: Password Input Validation

**Ambiguity:** Specification doesn't define password constraints.

**Clarification Required:**

Should we validate:

- Length (min 8 chars)?
- Complexity (uppercase, number, special)?
- Common passwords (blocklist)?

**Resolution:**
$$\boxed{\text{Minimal Phase 1: Length only}}$$

**Requirements:**

- Minimum 8 characters (max 256 to prevent DoS)
- Accept any characters (no complexity rules)
- Phase 2+: Enhanced rules

**Implication:** Validation happens at provisioning API, not auth. Auth just verifies hash.

---

### Question 6.2: JWT Secret Management

**Ambiguity:** How is JWT_SECRET stored and rotated?

**Clarification Required:**

Phase 1 (Dev):

- Environment variable (OK)

Phase 1 (Prod):

- Docker secret (OK)

Secret rotation:

- When? (Not Phase 1)
- How? (Not Phase 1)

**Resolution:**
$$\boxed{\text{Phase 1: Static secret, rotation Phase 2+}}$$

**Implication:**

- JWT_SECRET environment variable (dev) or Docker secret (prod)
- Document secret generation (32+ byte random)
- Phase 2: Implement rotation strategy

---

### Question 6.3: Token Expiration Enforcement

**Ambiguity:** Should we enforce server clock before checking expiration?

**Clarification Required:**

If server clock is 1 hour behind (NTP drift):

- Old tokens remain valid (correct)
- New tokens expire 1 hour late (security issue)

**Question:** How to detect/prevent?

**Resolution:**
$$\boxed{\text{NTP sync is DevOps responsibility}}$$

**Phase 1:**

- Require NTP sync on all servers
- No tolerance for clock drift > 1 second
- Alarm on NTP failure
- Document in DevOps runbook

**Implication:** Set up NTP monitoring before production. Log clock drift.

---

## 7. ERROR CONTRACT

### Question 7.1: Login Error Leakage (Timing Attack)

**Ambiguity:** Should invalid email and invalid password return same error?

**Specification Say:** "Invalid credentials" but doesn't specify exact message.

**Clarification Required:**

User submits: user@example.com + wrongpassword

Response options:

- (A) "Email or password is incorrect" (safe, both cases)
- (B) "User not found" (leaks if email exists)
- (C) "Password incorrect" (leaks if email exists)

**Also timing:** If we query DB for user, timing may reveal email doesn't exist (timing attack).

**Resolution:**
$$\boxed{\text{Option A: Same message + hash dummy password if user not found}}$$

**Implementation:**

```
IF user not found:
  → Verify dummy hash (bcrypt of empty string)
  → Adds ~100ms delay (same as real hash)
  → Returns same error message
ELSE:
  → Verify real hash
  → Returns same error message
ENDIF
```

**Implication:** Always perform password hashing (even if user not found) to prevent timing attacks.

---

### Question 7.2: HTTP Status Code Consistency

**Ambiguity:** Multiple scenarios return different codes, but are they consistent?

**Clarification Required:**

Scenarios:

- Invalid JWT signature → 401?
- Expired token → 401?
- Token from different workspace → 401?
- License SOFT_LOCKED → 423?
- Schema version mismatch → 426?

Are these the right codes?

**Resolution:**
$$\boxed{\text{Yes, all correct per HTTP semantics:}}$$

- **401 Unauthorized:** Token/auth information invalid (wrong sig, wrong workspace, expired)
- **403 Forbidden:** Permission denied (RBAC, archived license)
- **423 Locked:** Resource locked (SOFT_LOCKED license, account locked)
- **426 Upgrade Required:** Version mismatch (schema or product)
- **429 Too Many Requests:** Rate limited (failed login attempts)

**Implication:** Document this mapping in error contract. Consistent across all resources.

---

### Question 7.3: Error Message Internationalization

**Ambiguity:** Are error messages static strings or translated?

**Clarification Required:**

Phase 1: All English (OK)
Phase 2+: Translations

**Resolution:**
$$\boxed{\text{Static English Phase 1, i18n Phase 2+}}$$

**Implication:** No i18n layer now. Structure code to support it later.

---

## 8. ISOLATION BOUNDARIES

### Question 8.1: Cross-Domain Token Rejection

**Ambiguity:** Specification says MMC token should reject at frontoffice. Where does this check happen?

**Clarification Required:**

Scenario: MMC admin token (`scope: "MMC"`) sent to `/frontoffice/exams`

Check location:

- (A) Middleware (before route)
- (B) Route handler (inside logic)
- (C) Implicit (scope doesn't match, permission denied)

**Resolution:**
$$\boxed{\text{Option A: Middleware}}$$

**Implementation:**

```
Protected route declares allowed_scopes = ["FRONTOFFICE", "BACKOFFICE"]
Middleware checks: IF token.scope NOT IN allowed_scopes → 401 Unauthorized
```

**Implication:**

- Each route declares required scope(s)
- Middleware validates before handler executes
- Move scope validation to middleware layer

---

### Question 8.2: Student Division Boundary

**Ambiguity:** Can student from Division A view exams in Division B?

**Specification Say:** "division_id in token" but doesn't specify enforcement.

**Clarification Required:**

Scenario: Student logs in, gets token with division_id = "DIV_A"
Request: GET /frontoffice/divisions/DIV_B/exams

Question: Should this return:

- (A) 404 Not Found (route doesn't exist)
- (B) 403 Forbidden (permission denied)
- (C) Empty list (no exams in that division)

**Resolution:**
$$\boxed{\text{Option B: 403 Forbidden}}$$

**Logic:**

```
IF token.division_id != request.division_id
  → Return 403 Forbidden
ELSE:
  → Proceed
ENDIF
```

**Implication:**

- Division boundary is security boundary (403), not data boundary (404)
- Prevents information leakage (doesn't reveal existence of other divisions)
- Add this check to all division-scoped routes

---

### Question 8.3: MMC Token Access to Master Tables

**Ambiguity:** MMC token can access master_db, but should it be able to query tenant metadata?

**Clarification Required:**

Can MMC admin:

- (A) Query master_db.licenses, master_db.tenants_registry (YES)
- (B) Query tenant_db.users of any workspace (NO - cross-tenant)
- (C) Query audit logs of any workspace (?)

**Resolution:**
$$\boxed{\text{A: YES, B: NO, C: NO}}$$

**Rationale:**

- MMC = platform operations, not tenant operations
- If MMC needs audit logs, aggregate across tenants with explicit permission
- Tenant audit logs only queryable by tenant-authenticated users

**Implication:**

- MMC endpoints do NOT use tenant resolver
- MMC cannot access tenant-scoped tables
- If provisioning needs audit, separate endpoint with explicit checks

---

## Summary of Clarifications

### Resolved Ambiguities

| #   | Area         | Question                      | Resolution                      |
| --- | ------------ | ----------------------------- | ------------------------------- |
| 1.1 | Transactions | Isolation level?              | REPEATABLE READ                 |
| 1.2 | Transactions | Failed login tracking scope?  | Single transaction              |
| 1.3 | Transactions | Token gen failure rollback?   | Full rollback                   |
| 1.4 | Transactions | Token version race condition? | Add FOR UPDATE                  |
| 2.1 | Idempotency  | Login idempotent?             | NO, design correct              |
| 2.2 | Idempotency  | Logout-all idempotent?        | Outcome-idempotent              |
| 2.3 | Idempotency  | Password change?              | Phase 2+                        |
| 3.1 | Concurrency  | Concurrent logins?            | Allowed (multiple tokens)       |
| 3.2 | Concurrency  | Failed attempt race?          | SERIALIZABLE needed             |
| 3.3 | Concurrency  | Connection pool size?         | Drizzle default                 |
| 4.1 | Versioning   | Schema bump granularity?      | Per migration file              |
| 4.2 | Versioning   | Product version compat?       | SemVer rules                    |
| 4.3 | Versioning   | Min schema version set by?    | Operator-configurable           |
| 5.1 | Middleware   | Bypass prevention?            | Router composition              |
| 5.2 | Middleware   | Correlation ID priority?      | Extract or generate             |
| 5.3 | Middleware   | License cache TTL?            | 1 minute                        |
| 6.1 | Security     | Password validation?          | Length only (min 8)             |
| 6.2 | Security     | JWT secret management?        | Static Phase 1, rotate Phase 2+ |
| 6.3 | Security     | Clock drift tolerance?        | Zero tolerance, NTP mandatory   |
| 7.1 | Errors       | Email enumeration?            | Dummy password hash             |
| 7.2 | Errors       | HTTP codes?                   | Correctly mapped                |
| 7.3 | Errors       | Localization?                 | English Phase 1, i18n Phase 2+  |
| 8.1 | Isolation    | Cross-domain rejection?       | Middleware check                |
| 8.2 | Isolation    | Student division boundary?    | 403 Forbidden                   |
| 8.3 | Isolation    | MMC tenant access?            | Never (except licenses)         |

---

## Recommendations for Implementation

### High Priority (Must Have)

1. Add `FOR UPDATE` lock to token_version increment
2. Use SERIALIZABLE isolation for failed login counting
3. Implement dummy password hash for missing users
4. Add scope validation to middleware layer
5. Add division_id boundary check to routes

### Medium Priority (Should Have)

6. Implement license cache with 1-minute TTL
7. Document middleware composition pattern
8. Set up NTP monitoring for clock sync
9. Add HTTP status code documentation
10. Create migration metadata for schema_version tracking

### Low Priority (Phase 2+)

11. Implement secret rotation strategy
12. Add password complexity rules
13. Implement i18n for error messages
14. Add refresh token endpoint

---

## Constitutional Alignment

All clarifications validate against:

✅ **ADR-0001:** Isolation boundaries confirmed (no cross-tenant access)  
✅ **ADR-0006:** Server authoritative time (NTP mandatory)  
✅ **ADR-0007:** Version compatibility (SemVer rules applied)  
✅ **ADR-0008:** Semantic versioning (migration metadata defined)  
✅ **PROJECT_CONTEXT_PRIMER:** Middleware order, license enforcement, isolation

**Status:** ✅ All ambiguities identified and resolved

---

## Next Steps

1. Update spec.md with clarifications (FOR UPDATE, SERIALIZABLE, dummy hash)
2. Proceed to SpecKit Planning Phase
3. Generate implementation plan with clarifications incorporated
4. Create atomic tasks from plan
5. Execute implementation with full test coverage

**Ready for Planning Phase:** YES

### Q: Should MMC users and tenant users share authentication logic?

**Status:** ✅ RESOLVED

**Answer:** No. Three completely separate domains with different token structures, user tables, and middleware chains.

- MMC users: master_db.mmc_users
- Workspace staff/students: tenant_db.users
- Token validation: scope-aware (rejects cross-domain tokens)

**Justification:** ADR-0001 (database-per-tenant). Even MMC users are "platform-per-tenant" logic, warranting complete isolation.

---

### Q: What happens to tokens when workspace schema is upgraded?

**Status:** ✅ RESOLVED

**Answer:** Tokens become invalid (426 Upgrade Required). User must re-login to get a new token with updated schema_version.

**Example:**

```
Old token issued: schema_version=1.0.0
Workspace upgraded to: schema_version=1.1.0
Next request with old token: 426 Upgrade Required
User re-logs in: Gets new token with schema_version=1.1.0
```

**Rationale:** Ensure session-specific compatibility checks. Prevents old code paths from executing against new schema.

---

### Q: How do we prevent session hijacking across workspaces?

**Status:** ✅ RESOLVED

**Answer:** Three-layer defense:

1. **Token layer:** workspace_id embedded in JWT
2. **Validation layer:** Every request compares token.workspace_id against resolved workspace_id
3. **Middleware layer:** Workspace resolved BEFORE token validation, so mismatch is early-caught

**Result:** A token from Workspace A cannot function in Workspace B (returns 401).

---

### Q: Can a user have multiple roles?

**Status:** ✅ RESOLVED

**Answer:** Phase 1: No, one role per user (ADMIN, STAFF, INSTRUCTOR, or STUDENT).

Phase 2+: Yes, via user_roles many-to-many table. Permission grants would be additive (union of role permissions).

**Phase 1 Implementation:** user_roles table exists but enforces UNIQUE(user_id, role_id), ensuring one-to-one during Phase 1.

---

### Q: Where should permission checks happen?

**Status:** ✅ RESOLVED

**Answer:** Backend only. Never frontend.

**Process:**

1. Route receives request + JWT
2. Extract role from JWT
3. Query role_permissions
4. Compare requested action against user permissions
5. Return 403 if permission denied

**Frontend:** Receives permissions in JWT or separate API call, but does NOT enforce (UX hint only).

---

### Q: What if a user's role changes mid-session?

**Status:** ✅ RESOLVED

**Answer:** Old token remains valid (old permissions still work).

**Security consideration:** This is acceptable because:

- User can call logout-all to revoke all tokens
- Admin can increment token_version to force logout
- Next login gets new token with updated role

**Phase 2+:** Refresh token endpoint could enforce permission re-validation.

---

### Q: How long do tokens live?

**Status:** ✅ RESOLVED

**Answer:** Phase 1: 15 minutes (recommended, configurable at runtime).

**TTL:** 15 minutes balances security (short-lived) vs. user experience (not too frequent re-login).

**Refresh:** Phase 2+ (out of scope).

---

### Q: Can a student from Division A access exams in Division B?

**Status:** ✅ RESOLVED

**Answer:** No. Student token includes division_id.

**Enforcement:** API checks claim:

```
IF jwt.division_id != exam.division_id
  → Return 403 Forbidden
```

**Future Phase 1+:** Student can change division (rare use case), which increments token_version, forcing re-login.

---

### Q: What if license becomes SOFT_LOCKED mid-session?

**Status:** ✅ RESOLVED

**Answer:** Next request returns 423 Locked (even with valid token).

**Flow:**

1. User logs in, gets token (license is ACTIVE)
2. License admin soft-locks workspace
3. User clicks button → API request with old token
4. License middleware checks: License is SOFT_LOCKED → 423

**User Experience:** Session exists but access denied. Re-enable license to restore.

---

### Q: Should login be idempotent?

**Status:** ✅ RESOLVED

**Answer:** No, intentionally not idempotent.

**Rationale:**

- Multiple calls = multiple unique tokens
- Each token valid independently
- Client responsible for single-submit via UI

**Why not?** Idempotent login would require session tracking (violates statelessness). Better to let client handle it.

---

### Q: Should audit logs be queryable in real-time?

**Status:** ✅ RESOLVED

**Answer:** Yes, indexed queries (user, workspace, correlation_id).

**Query Patterns:**

- `SELECT * FROM audit_logs WHERE user_id = ? AND timestamp > ? ORDER BY timestamp DESC` — User activity
- `SELECT * FROM audit_logs WHERE workspace_id = ? AND event_type = 'login_success'` — Successful logins only
- `SELECT * FROM audit_logs WHERE correlation_id = ?` — Trace single request

**Retention:** 90 days default (compliance-dependent).

---

### Q: What's the max account lock duration?

**Status:** ✅ RESOLVED

**Answer:** 30 minutes (configurable).

**Threshold:** 5 failed attempts in 15 minutes → lock for 30 minutes.

**Unlock mechanisms:**

- Time passes (after 30 minutes, account auto-unlocks)
- Admin manually unlocks (set locked_until = NOW() - 1 hour)
- Successful login resets counter (new 15-minute window)

---

### Q: Should token_version be per-user or per-app?

**Status:** ✅ RESOLVED

**Answer:** Per-user (stored in users table).

**Rationale:** Logout-all invalidates all tokens for that user, not per-app. If user logs in from web + mobile, both get invalidated.

---

### Q: How do we handle password hash algorithm upgrades?

**Status:** ✅ RESOLVED

**Answer:** Phase 2 concern, out of scope for Phase 1.

**Approach (documented for future):**

- Maintain two hash algorithms (old + new)
- On successful login with old hash: Re-hash with new algorithm, store both
- Gradually migrate users to new algorithm
- Phase out old algorithm after migration window

---

### Q: Can a student belong to multiple divisions?

**Status:** ✅ RESOLVED

**Answer:** No, one division per student (career students across divisions handled in Phase 2+).

**Constraint:**

```sql
CONSTRAINT student_single_division CHECK (
  (role = 'STUDENT' AND division_id IS NOT NULL) OR
  (role != 'STUDENT' AND division_id IS NULL)
)
```

---

### Q: Should failed login attempts be logged before or after lock?

**Status:** ✅ RESOLVED

**Answer:** Both events logged separately.

```
5 failed attempts in 15 minutes:
  → Event 1-5: login_failed events (5 rows)
  → At attempt 5: account_locked event
  → Attempts 6-10: return 429 without logging new rows
```

**Retention:** login_attempts (detail), audit_logs (summary).

---

## Open Questions

_(None currently — all clarifications resolved.)_

---

## Assumptions

### Assumption 1: One Workspace per Email

**Assumption:** An email can log in to one workspace only.

**Implication:** Support staff using multiple workspaces must have separate email accounts per workspace.

**Rationale:** Simplified token model (no workspace-switching).

**Phase 2+:** Could support workspace-switching with explicit user action.

---

### Assumption 2: Password Recovery Out of Scope

**Assumption:** Password reset is Phase 2+ feature.

**Phase 1 Behavior:** Locked-out user must contact admin for manual reset.

**Implementation:** Admin can generate temporary password or reset via provisioning API.

---

### Assumption 3: No IP Geofencing Phase 1

**Assumption:** IP-based access control (Phase 3+), not Phase 1.

**Phase 1:** IP logged for audit, not enforced.

---

### Assumption 4: Subscription Expiry ≠ Access Denial

**Assumption:** Expired subscription does not immediately deny access.

**Phase 1 Behavior:**

- Student can log in (subscription_status in token)
- Frontoffice API checks subscription before granting access
- Student can view certificates, but not attempt exams

**Rationale:** Allow grace period for subscription renewal.

---

### Assumption 5: No Multi-Factor Authentication Phase 1

**Assumption:** Email/password only for Phase 1.

**Phase 2+:** MFA support (TOTP, SMS, etc.).

---

### Assumption 6: JWT Stored in Memory Only

**Assumption:** No localStorage/cookies Phase 1 (Web app only).

**Security Rationale:** Prevents XSS token theft.

**Mobile Phase 2+:** Secure keychain/keystore for native apps.

---

### Assumption 7: License Validation Always Synchronous

**Assumption:** License check happens in request path (not async).

**Implication:** License state changes may have 1-2s delay before enforced.

**Rationale:** Acceptable for Phase 1 (license changes rare).

---

### Assumption 8: No Token Blacklist

**Assumption:** Logout doesn't add token to blacklist (uses version increment instead).

**Benefit:** Stateless, scalable across multiple servers.

**Cost:** Logout is not instantaneous (must wait for token to expire).

**Mitigation:** token_version increment enables immediate logout-all.

---

## Future Clarifications (Out of Scope)

- Refresh token rotation strategy
- API key support
- OAuth2 / OIDC integration
- SSO / SAML
- MFA challenge flow
- Device trust model
- Geographic restrictions
- Passwordless auth
- Biometric auth

---

## Constitutional Alignment

All clarifications have been validated against:

✅ ADR-0001: Database-per-tenant (workspace isolation confirmed)  
✅ ADR-0006: Authoritative time (server time only)  
✅ ADR-0007: Version compatibility (schema_version enforced)  
✅ ADR-0008: Semantic versioning (migration strategy aligned)  
✅ PROJECT_CONTEXT_PRIMER: Middleware order, license enforcement, isolation

**Status:** No conflicts detected. Ready for implementation planning.
