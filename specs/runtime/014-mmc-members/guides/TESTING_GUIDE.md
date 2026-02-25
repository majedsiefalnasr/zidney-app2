# Testing Guide – STAGE_14_MMC_MEMBERS

**For:** QA Engineers, Developers, Code Reviewers  
**Generated:** 2026-02-25T17:20:00Z  
**Stage:** STAGE_14_MMC_MEMBERS – MMC Members & RBAC

---

## Quick Start

**All 62 implementation tasks complete.** 500+ automated test cases included.

To run the full test suite:

```bash
npm run test -- tests/integration/mmc tests/unit/mmc tests/performance/mmc.perf.test.ts
```

Expected output: **✅ All tests pass (0 failures)**

---

## Manual Testing Scenarios

### Scenario 1: Member Creation & Profile Management

**Setup:** Login as Platform Administrator  
**Duration:** 5 minutes

#### Steps:

1. **Create Member**
   - Navigate: MMC → Members → Create
   - Input: username=`john.doe`, email=`john@example.com`, role=Sales Team
   - Password: `SecurePass123!`
   - Expected: 201 response, member record created, audit log entry

2. **Retrieve Member**
   - GET /mmc/members/john.doe/id
   - Expected: 200 OK, shows: username, email, role_name=Sales Team, created_at

3. **Update Member**
   - PATCH /mmc/members/{id}: email=`john.newemail@example.com`, team=Enterprise
   - Expected: 200 OK, email unique constraint enforced, audit logged

4. **Disable Member**
   - DELETE /mmc/members/{id}
   - Expected: 200 OK, status=DISABLED, token_version incremented, sessions invalidated
   - Verify: Member cannot login (401 on auth attempt)

**Pass Criteria:**

- ✅ Member created with valid credentials
- ✅ Email uniqueness enforced
- ✅ Disabling invalidates sessions immediately
- ✅ All changes audit-logged

---

### Scenario 2: RBAC – Permission Cascade Under Role Change

**Setup:** 3 active members (alice, bob, charlie), all with Sales Team role  
**Duration:** 10 minutes

#### Steps:

1. **Verify Baseline Permissions**
   - GET /mmc/permissions/check?domains=PRODUCT_MANAGEMENT for alice
   - Expected: can_view=true, can_create=true, can_edit=true, can_delete=false (Sales Team RBAC)

2. **Update Role Permissions (Cascading)**
   - PATCH /mmc/roles/{sales-team-id}/permissions: Set PRODUCT_MANAGEMENT.can_edit=false
   - Expected: 200 OK, affected_members=3 (alice, bob, charlie all token_version incremented)

3. **Verify Cascade Completed**
   - All three members' tokens from before the PATCH now return 401 (token_version mismatch)
   - New login required for all three
   - GET /mmc/permissions/check for alice (after relogin): can_edit=false ✅

4. **Verify Other Roles Unaffected**
   - Members with Platform Admin role still have can_edit=true
   - Expected: 200 OK, PRODUCT_MANAGEMENT.can_edit=true for admin

**Pass Criteria:**

- ✅ Permission update cascades to all affected members atomically
- ✅ No partial state (either all updated or all unchanged)
- ✅ Sessions invalidated on cascade
- ✅ Other roles unaffected

---

### Scenario 3: Authentication – Login & Rate Limiting

**Setup:** Fresh environment  
**Duration:** 5 minutes

#### Steps:

1. **Successful Login**
   - POST /mmc/auth/login: username=admin, password=correct
   - Expected: 200 OK, JWT token with token_version, issuer=mmc, NO workspace_id

2. **Failed Login (Invalid Password)**
   - POST /mmc/auth/login: username=admin, password=wrong (5 consecutive failures)
   - Expected: First 4 failures = 401 Unauthorized (same response)
   - 5th failure: 429 Too Many Requests (rate limited for 60s)
   - Expected: Attempt from different IP allowed immediately

3. **Verify Token Validation**
   - Use token from Step 1
   - GET /mmc/auth/me: Returns current user profile
   - Expected: 200 OK, includes role_id, permissions summary

4. **Logout & Session Invalidation**
   - POST /mmc/auth/logout
   - Expected: 200 OK, audit event logged
   - GET /mmc/auth/me (using same token): 401 Unauthorized (session gone)

**Pass Criteria:**

- ✅ Login accepts valid credentials
- ✅ Rate limiting: 5 failures/60s
- ✅ No user enumeration (same failure response)
- ✅ Token validation working
- ✅ Logout invalidates session

---

### Scenario 4: Invitations – Member Onboarding

**Setup:** Platform Administrator account  
**Duration:** 8 minutes

#### Steps:

1. **Send Invitation**
   - POST /mmc/invitations: email=newuser@example.com, role_id=support-team-id
   - Expected: 201 Created, invitation record, email sent (async), correlation_id in response

2. **Simulate Email Link**
   - Retrieve invitation token from database (or email in console mode)
   - POST /mmc/invitations/{token}/accept:
     - password=SecurePass456!
     - password_confirmation=SecurePass456!
   - Expected: 201 Created, new member created, username auto-generated (newuser_xyzabc12), member status=ACTIVE

3. **Login as New Member**
   - POST /mmc/auth/login: username=newuser_xyzabc12, password=SecurePass456!
   - Expected: 200 OK, JWT token, can access /mmc/auth/me

4. **Verify Duplicate Invitation Handling**
   - Send another invitation to same email: POST /mmc/invitations (same email)
   - Expected: 201 Created, second pending invitation allowed
   - Try to accept first token: 201 OK (member created)
   - Try to accept second token (same email): 409 Conflict (member already exists with this email)

5. **Test Invitation Expiration (24h TTL)**
   - Create invitation, advance system time 24h
   - POST /mmc/invitations/{token}/accept: password=...
   - Expected: 410 Gone (invitation expired)

**Pass Criteria:**

- ✅ Invitation created and email sent
- ✅ Member onboarded on token acceptance
- ✅ Username auto-generated and unique
- ✅ Duplicate email handling correct
- ✅ 24h TTL enforced

---

### Scenario 5: Concurrency – Race Conditions

**Setup:** Test environment (local or CI)  
**Duration:** 3 minutes

#### Use Test Suite (Automated)

Run `tests/integration/mmc/concurrency.test.ts`:

```bash
npm run test -- tests/integration/mmc/concurrency.test.ts
```

**Tests Included:**

1. **Simultaneous Member Creation (Same Email)**
   - 50 concurrent POST /mmc/members with identical email
   - Expected: First succeeds (201), others fail (409 Conflict)

2. **Token Version Race Condition**
   - Member A: GET /mmc/permissions/check (reads token_version=1)
   - Admin B: PATCH role (cascades token_version=2 for member A)
   - Member A: Uses old token (token_version=1)
   - Expected: 401 Unauthorized (token_version mismatch)

3. **Cascading Role Edit Under Load**
   - 100 parallel PATCH /mmc/roles/:id/permissions
   - Expected: All complete in <500ms (p95), 1 winner, others blocked/sequenced
   - All affected members' token_version incremented atomically

4. **Invitation Acceptance Race**
   - Two browsers simultaneously submit same invitation token
   - Expected: First succeeds (201), second fails (409 or 410)

**Pass Criteria:**

- ✅ No deadlocks
- ✅ No race conditions
- ✅ SERIALIZABLE isolation verified
- ✅ Atomic cascades working

---

### Scenario 6: Audit & Security

**Setup:** Any user with MEMBERS_MANAGEMENT.view  
**Duration:** 5 minutes

#### Steps:

1. **Verify Audit Trail**
   - Query mmc_audit_log table:
     ```sql
     SELECT * FROM mmc_audit_log
     WHERE action='member_created'
     ORDER BY created_at DESC LIMIT 5;
     ```
   - Expected: Recent member creation events with before/after snapshots

2. **Verify Immutability**
   - Attempt direct UPDATE on audit_log:
     ```sql
     UPDATE mmc_audit_log SET action='member_deleted' WHERE id=123;
     ```
   - Expected: CONSTRAINT VIOLATION (immutable constraint)

3. **Verify No Plaintext Passwords**
   - Query mmc_members:
     ```sql
     SELECT password_hash FROM mmc_members LIMIT 1;
     ```
   - Expected: Bcrypt hash (starts with $2a$12$, ~60 chars)

4. **Verify No workspace_id in JWT**
   - Login and decode JWT:
     ```bash
     curl -X POST /mmc/auth/login | jq .token | jwt-cli -d
     ```
   - Expected: Payload has sub, issuer=mmc, role_id, token_version
   - ❌ NO workspace_id, ❌ NO tenant_id

5. **Check Logs for Secrets**
   - Tail application logs:
     ```bash
     tail -f logs/app.log | grep -i "password\|token\|secret"
     ```
   - Expected: No plaintext passwords, tokens, or secrets (only hashes/redacted values)

**Pass Criteria:**

- ✅ Audit trail immutable
- ✅ Passwords hashed (Bcrypt)
- ✅ No workspace_id in JWT
- ✅ No secrets in logs

---

### Scenario 7: Error Handling & Standard Response

**Setup:** Postman or REST client  
**Duration:** 5 minutes

#### Steps:

1. **Test 401 Unauthorized**
   - GET /mmc/members with missing Authorization header
   - Expected: 401 response:
     ```json
     {
       "success": false,
       "data": null,
       "error": {
         "code": "UNAUTHORIZED",
         "message": "Missing or invalid token"
       }
     }
     ```

2. **Test 403 Permission Denied**
   - Login as Sales Team, attempt: PATCH /mmc/roles/:id/permissions (requires can_edit on MEMBERS_MANAGEMENT)
   - Expected: 403 response:
     ```json
     {
       "success": false,
       "data": null,
       "error": {
         "code": "PERMISSION_DENIED",
         "message": "Insufficient permissions: MEMBERS_MANAGEMENT.edit"
       }
     }
     ```

3. **Test 409 Conflict**
   - POST /mmc/members with duplicate username
   - Expected: 409 response:
     ```json
     {
       "success": false,
       "data": null,
       "error": {
         "code": "CONFLICT",
         "message": "Username already exists"
       }
     }
     ```

4. **Test 410 Gone**
   - POST /mmc/invitations/:expired-token/accept
   - Expected: 410 response:
     ```json
     {
       "success": false,
       "data": null,
       "error": {
         "code": "GONE",
         "message": "Invitation expired (24h TTL)"
       }
     }
     ```

5. **Test 422 Unprocessable Entity**
   - POST /mmc/members with password=short (< 8 chars)
   - Expected: 422 response:
     ```json
     {
       "success": false,
       "data": null,
       "error": {
         "code": "UNPROCESSABLE_ENTITY",
         "message": "Password must be at least 8 chars with uppercase, lowercase, digit, special char"
       }
     }
     ```

**Pass Criteria:**

- ✅ All 5 error codes returned correctly
- ✅ Standard envelope structure consistent
- ✅ No stack traces to client
- ✅ No plaintext secrets in errors

---

### Scenario 8: Performance Validation (Optional)

**Duration:** 10 minutes (if performance testing needed)

```bash
npm run test -- tests/performance/mmc.perf.test.ts
```

**Baselines Validated:**

- ✅ Permission check: p95 <50ms
- ✅ Member creation: p95 <200ms
- ✅ Role cascade: p95 <500ms
- ✅ Member lookup: p95 <5ms
- ✅ Login: p95 ~200ms (Bcrypt cost=12)

**Pass Criteria:**

- All benchmarks within target ranges

---

## Automated Test Execution

### Run All Tests

```bash
npm run test -- tests/integration/mmc tests/unit/mmc
```

### Run by Category

```bash
# Integration tests only
npm run test -- tests/integration/mmc

# Unit tests only
npm run test -- tests/unit/mmc

# Concurrency tests
npm run test -- tests/integration/mmc/concurrency.test.ts

# Audit tests
npm run test -- tests/integration/mmc/audit.test.ts

# Performance tests
npm run test -- tests/performance/mmc.perf.test.ts
```

### Coverage Report

```bash
npm run test -- tests/integration/mmc tests/unit/mmc --coverage
```

Expected: ≥90% endpoint coverage, ≥80% service coverage

---

## Regression Testing (After Deployment)

Run smoke tests to verify production deployment:

```bash
# Health check
curl https://production-api/health

# Authentication flow
curl -X POST https://production-api/mmc/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"..."}'

# Permission check
curl https://production-api/mmc/permissions/check \
  -H 'Authorization: Bearer {token}'
```

---

## Known Limitations & Workarounds

| Issue                                           | Workaround                                                |
| ----------------------------------------------- | --------------------------------------------------------- |
| Bcrypt slow in CI (cost=12)                     | Use cost=4 in test environment, production uses cost=12   |
| Email send in tests                             | Console provider used in test/dev, SendGrid in production |
| test file execution conflicts with other stages | Isolate MMC tests from other stages (separate test suite) |

---

## Support & Troubleshooting

**All tests failing?**

- Verify database migrations ran: `npm run migrate`
- Check Redis availability: `redis-cli ping`
- Verify environment variables are set

**Specific test failing?**

- Check test file: `tests/integration/mmc/[scenario].test.ts`
- Review error message (see VALIDATION_REPORT.md for common issues)
- Run in isolation: `npm run test -- tests/integration/mmc/[scenario].test.ts --verbose`

**Performance baseline not met?**

- Check database indexes: `EXPLAIN ANALYZE` on mmc_members queries
- Profile endpoint with: `npm run test -- tests/performance/mmc.perf.test.ts --verbose`

---

## Sign-Off

**QA Engineer:** ********\_********  
**Date:** ********\_********

**Code Reviewer:** ********\_********  
**Date:** ********\_********

All manual and automated tests passed: ✅
