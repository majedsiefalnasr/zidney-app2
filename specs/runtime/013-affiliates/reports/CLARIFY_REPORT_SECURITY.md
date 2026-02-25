# Clarify Report (Security Tightening) — STAGE_13_AFFILIATES

**Step:** 5a — Targeted Security Clarification Session  
**Timestamp:** 2026-02-25T00:30:00Z  
**Status:** COMPLETE

---

## Summary

Targeted clarification session resolved 3 critical API boundary and security architectural gaps identified by drift analysis. All clarifications address the 2/9 criteria failures:

1. **API Boundary Violations** → Clarified admin endpoint placement, RBAC, token validation strategy
2. **Security Vulnerabilities** → Locked promo code validation, token infrastructure, and MMC authentication

All clarifications appended to `spec.md` under "Clarifications → Session 2026-02-25 (Part 2 — Security Clarifications)".

---

## Clarifications Locked (Security Track)

| #   | Gap                             | Decision                                                                                                      | Impact                                                                                      |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Q6  | **Admin Endpoint Placement**    | Backend API (`apps/api/src/routes/mmc/affiliates/`)                                                           | Routes centralized in API, reuses existing infrastructure, no tenant resolver for admin ops |
| Q7  | **MMC Token Validation**        | JWT HS256 with 24-hour expiry, validation middleware at `apps/api/src/middleware/auth/mmc-token-validator.ts` | Unambiguous token strategy; NEW middleware explicitly required                              |
| Q8  | **Promo Code Input Validation** | Zod schema: `z.string().trim().toUpperCase().min(3).max(50).regex(/^[A-Z0-9]+$/)`                             | Input validated before DB query; SQL injection prevention confirmed                         |

---

## Spec Updates Applied

**Location in spec.md**: New section appended:

```
### Session 2026-02-25 (Part 2 — Security Clarifications)

#### Q6: Admin Endpoint Placement & Tenant Resolver Handling
[Decision + Spec Update for routing, RBAC, MMC auth]

#### Q7: MMC Token Validation Strategy
[Decision + Spec Update for JWT, signing, middleware location, validation logic]

#### Q8: Promo Code Input Validation in License Purchase
[Decision + Spec Update for Zod schema, error handling, normalization]
```

---

## Constitutional Compliance Impact

**Before Clarification** (Drift Analysis Result):

- Criterion #7 (API Boundary): 🚨 FAIL (3 critical issues)
- Criterion #8 (Security): 🚨 FAIL (4 critical issues)
- **Overall**: 7/9 BLOCKED

**After Clarification** (Expected in Re-Audit):

- Admin endpoint placement: ✓ Explicit (Backend API)
- RBAC enforcement: ✓ Explicit (Middleware chain documented)
- Token validation: ✓ Explicit (NEW middleware file + validation logic)
- Promo code validation: ✓ Explicit (Zod schema specified)
- SQL injection prevention: ✓ Confirmed (Input validated before query)
- Rate limiting: ⟲ PENDING (Plan security tightening pass will add verification)
- Logging policy: ⟲ PENDING (Plan security tightening pass will specify)
- Admin token infrastructure: ⟲ PENDING (Plan security tightening pass will add verification task)

---

## Implementation Impact

These clarifications create NEW REQUIRED TASKS for plan.md:

| Task Type                                         | Priority    | Owner Phase                        |
| ------------------------------------------------- | ----------- | ---------------------------------- |
| Implement MMC token validator middleware          | 🚨 CRITICAL | Foundation (T006-T010 range)       |
| Add Zod schema for promo_code in license purchase | 🚨 CRITICAL | License Purchase (T020-T026 range) |
| Add SQL injection prevention tests                | 🚨 CRITICAL | Testing (T037-T041 range)          |
| Verify admin rate limiting middleware             | ⚠️ HIGH     | Foundation or Testing              |
| Document logging policy for promo codes + tokens  | ⚠️ HIGH     | Observability (T033-T036 range)    |

---

## Next Phase: Plan Security Tightening

After clarifications are locked in spec.md, run speckit.plan to:

1. **Add MMC Token Validation Middleware Task**
   - Task: "Implement JWT token validator at `apps/api/src/middleware/auth/mmc-token-validator.ts`"
   - Include: Signature verification, expiry check, role validation test

2. **Add SQL Injection Prevention Tasks**
   - Task: "Add SQL injection test: Attempt `' OR 1=1; -- ` promo code rejection"
   - Confirm: All affiliate queries parameterized (Drizzle ORM enforcement check)

3. **Add Admin Rate Limiting Verification**
   - Task: "Verify admin rate limiting middleware exists on `/api/v1/mmc/affiliates/*` routes"
   - If missing: Implement 5-10 requests/minute limit + test 429 rejection

4. **Add Logging Policy Tasks**
   - Task: "Document + implement promo code masking in logs (hash prefix only)"
   - Task: "Confirm: Never log full JWT tokens (mask to token_id/exp only)"

---

## Readiness for Re-Audit

✅ **Approved for Plan Security Tightening Pass**

All 3 critical architectural gaps have explicit clarifications. Specification is now precise enough for plan.md to define all necessary implementation tasks.

Next: Run `/speckit.plan` with security tightening scope.
