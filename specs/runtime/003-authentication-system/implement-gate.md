# IMPLEMENTATION GATE – Authentication System (STAGE_03)

**Phase:** 1 – Platform Foundation  
**Stage:** STAGE_03_AUTHENTICATION_SYSTEM  
**Gate Date:** 2026-02-17  
**Status:** READY FOR IMPLEMENTATION ✅

---

## Pre-Implementation Gate Validation

### Checkpoint 1: Analyze Step Passed

**Requirement:** analyze.md must be complete with ZERO violations  
**Status:** ✅ PASS

Reference: [analyze.md](./analyze.md)

- ✅ Scope validation: PASS
- ✅ Isolation audit: PASS
- ✅ License enforcement audit: PASS
- ✅ Transaction safety audit: PASS
- ✅ Idempotency audit: PASS
- ✅ Snapshot integrity audit: PASS (N/A)
- ✅ Versioning & migration audit: PASS
- ✅ Observability audit: PASS
- ✅ Security audit: PASS

**Violations detected:** ZERO (0)  
**Architectural drift:** ZERO (0)  
**Blockers:** ZERO (0)

**Gate Result:** ✅ PROCEED

---

### Checkpoint 2: Constitutional Compliance

**Requirement:** No violations to Zidney Constitution v1.2.0  
**Status:** ✅ COMPLIANT

**Trust Chain Validation:**

```
Isolation → License → Authentication → Attempt → Runtime → Frontoffice
     ✅         ✅            ✅          ✅        ✅         ✅
```

**Constitution Confirmations:**

- ✅ Database-per-tenant isolation enforced (workspace_id validation)
- ✅ License middleware mandatory (ACTIVE required)
- ✅ Authentication layer isolated (no grading involvement)
- ✅ Attempt engine untouched (auth is stateless)
- ✅ Server time authoritative (PostgreSQL NOW())
- ✅ Frontoffice receives token only (no logic)

**Gate Result:** ✅ PROCEED

---

### Checkpoint 3: Ambiguity Resolution

**Requirement:** All specification ambiguities resolved in clarify.md  
**Status:** ✅ COMPLETE

Reference: [clarify.md](./clarify.md)

**24 Clarifications Resolved Across 8 Areas:**

1. **Transactions (4 clarifications)**
   - ✅ QA-1.1: REPEATABLE READ isolation level
   - ✅ QA-1.2: Single transaction for failed attempt + lock
   - ✅ QA-1.3: Full rollback on token generation failure
   - ✅ QA-1.4: FOR UPDATE row lock on token_version

2. **Idempotency (3 clarifications)**
   - ✅ QA-2.1: Login NOT idempotent (multiple tokens OK)
   - ✅ QA-2.2: Logout outcome-idempotent (all tokens invalid)
   - ✅ QA-2.3: Seed atomic (ON CONFLICT DO NOTHING)

3. **Concurrency (3 clarifications)**
   - ✅ QA-3.1: Concurrent logins allowed (different tokens)
   - ✅ QA-3.2: Failed attempt counting SERIALIZABLE (no race)
   - ✅ QA-3.3: Token version increment atomic (FOR UPDATE)

4. **Version Enforcement (3 clarifications)**
   - ✅ QA-4.1: schema_version includes in JWT
   - ✅ QA-4.2: Mismatch triggers 426 (re-login required)
   - ✅ QA-4.3: Product version SemVer compatibility

5. **Middleware Enforcement (2 clarifications)**
   - ✅ QA-5.1: Order: CorrID → Resolver → License → Schema → Route
   - ✅ QA-5.2: Router composition (not decorators, no bypass)

6. **Security Validation (3 clarifications)**
   - ✅ QA-6.1: Email enumeration protection (dummy hash)
   - ✅ QA-6.2: RBAC server-side only (no frontend)
   - ✅ QA-6.3: JWT workspace scope validation

7. **Error Contract (2 clarifications)**
   - ✅ QA-7.1: Standard contract: {success, data, error}
   - ✅ QA-7.2: HTTP codes: 401/403/423/426/429

8. **Isolation Boundaries (1 clarification)**
   - ✅ QA-8.1: WHERE clause in middleware (not route handler)

**Unresolved Ambiguities:** ZERO (0)  
**Gate Result:** ✅ PROCEED

---

## Execution Scope Confirmation

### Allowed Changes

| Scope                        | Files                                     | Modification Allowed                                         |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| **Database - Master**        | `apps/api/src/db/master/migrations/`      | ✅ YES (0003_create_mmc_users.sql)                           |
| **Database - Tenant**        | `apps/api/src/db/tenant/migrations/`      | ✅ YES (0003_create_auth_tables.sql)                         |
| **Database - Seeds**         | `apps/api/src/db/tenant/seeds/`           | ✅ YES (0001_default_roles.sql)                              |
| **Domain Logic**             | `packages/domain-core/auth/`              | ✅ YES (password.ts, jwt.ts, rbac.ts)                        |
| **Auth Types**               | `packages/types/auth.ts`                  | ✅ YES                                                       |
| **Validation**               | `packages/validation/auth-schemas.ts`     | ✅ YES                                                       |
| **API Middleware**           | `apps/api/src/middleware/`                | ✅ YES (correlation-id, jwt-validation, error-handler, etc.) |
| **API Routes - MMC**         | `apps/api/src/routes/mmc/auth.ts`         | ✅ YES                                                       |
| **API Routes - Backoffice**  | `apps/api/src/routes/backoffice/auth.ts`  | ✅ YES                                                       |
| **API Routes - Frontoffice** | `apps/api/src/routes/frontoffice/auth.ts` | ✅ YES                                                       |
| **Frontend - Stores**        | `apps/frontoffice/src/stores/auth.ts`     | ✅ YES                                                       |
| **Frontend - API Client**    | `apps/frontoffice/src/api/client.ts`      | ✅ YES                                                       |
| **Frontend - Pages**         | `apps/frontoffice/src/pages/Login.vue`    | ✅ YES                                                       |
| **Frontend - Router**        | `apps/frontoffice/src/router/guards.ts`   | ✅ YES                                                       |
| **Observability**            | `apps/api/src/utils/auth-logger.ts`       | ✅ YES                                                       |
| **Observability**            | `apps/api/src/metrics/auth-metrics.ts`    | ✅ YES                                                       |
| **Tests**                    | `apps/api/tests/integration/`             | ✅ YES                                                       |
| **Tests**                    | `packages/domain-core/auth/__tests__/`    | ✅ YES                                                       |
| **Environment**              | `.env.example`                            | ✅ YES (add JWT_SECRET)                                      |

### Forbidden Changes

| Scope                      | Files                                        | Modification Forbidden       |
| -------------------------- | -------------------------------------------- | ---------------------------- |
| **Program Metadata**       | `PROJECT_CONTEXT_PRIMER.md`                  | ❌ NO (read-only)            |
| **Architecture Rules**     | `docs/architecture/ADR-*`                    | ❌ NO (read-only)            |
| **Engineering Governance** | `docs/01_ENGINEERING_GOVERNANCE/`            | ❌ NO (read-only)            |
| **Other Stages**           | `apps/api/src/routes/{other_auth_domains}/`  | ❌ NO                        |
| **Worker Layer**           | `apps/worker/`                               | ❌ NO (not in Phase 1 scope) |
| **MMC App**                | `apps/mmc/` (except auth routes)             | ❌ NO                        |
| **Backoffice App**         | `apps/backoffice/` (except auth scaffolding) | ❌ NO                        |
| **Attempt Engine**         | `packages/domain-core/attempt/`              | ❌ NO                        |
| **Grading**                | Any grading logic                            | ❌ NO (worker-only)          |

**Scope Boundary:** Strict isolation to authentication layer  
**Gate Result:** ✅ CONFIRMED

---

## Implementation Constraints

### Mandatory Enforcement

#### 1. Tenant Resolver Required

**Rule:** All tenant database queries MUST use tenant resolver context

✅ **Correct Pattern:**

```typescript
const tenantDb = c.get('tenant_db') // From middleware
const user = await tenantDb.select().from(users).where(eq(users.email, email))
```

❌ **Forbidden Pattern:**

```typescript
const db = new Database(CONNECTION_URL) // Direct instantiation
const pool = getGlobalPool() // Global singleton
```

**Enforcement:** Router composition prevents bypass (middleware required)

#### 2. Transactional Writes

**Rule:** ALL write operations must be wrapped in database transactions

✅ **Write Operations:**

- `POST /*/auth/login` → Transaction (REPEATABLE READ + FOR UPDATE)
- `POST /*/auth/logout` → Transaction (FOR UPDATE)
- `POST /*/auth/logout-all` → Transaction (FOR UPDATE)
- `INSERT audit_logs` → Within login transaction
- `INSERT login_attempts` → Within login transaction
- `UPDATE users.locked_until` → Within login transaction
- `UPDATE users.token_version` → Within logout transaction

✅ **Transaction Requirements:**

- Isolation level: REPEATABLE READ (except failed attempt counting → SERIALIZABLE)
- Concurrency guard: FOR UPDATE row locks
- Rollback path: Full transaction on error
- No partial commits

#### 3. Idempotency Implementation

**Rule:** Idempotency implemented where specified in plan.md

✅ **Idempotent Operations:**

- `POST /*/auth/logout` → Outcome-idempotent (all tokens invalid)
- `POST /*/auth/logout-all` → Outcome-idempotent (all tokens invalid)
- Seed roles → Atomic (ON CONFLICT DO NOTHING)

❌ **Non-Idempotent (Intentional):**

- `POST /*/auth/login` → Multiple calls = multiple tokens (expected)

#### 4. Version Enforcement Active

**Rule:** schema_version and product_version validated on EVERY request

✅ **Version Checks:**

- JWT contains `schema_version` and `product_version`
- On request: Compare token versions against workspace versions
- Mismatch → Return 426 (Upgrade Required)
- User must re-login to get new token with new versions

**Enforcement:** API-002 (JWT validation middleware)

#### 5. Worker-Only Grading

**Rule:** No grading logic in auth layer

✅ **Confirmation:** Auth is stateless, does NOT calculate scores or grades  
**Scope:** Authentication only, not attempt-bound

#### 6. Server-Authoritative Time

**Rule:** ALL timestamps use PostgreSQL NOW(), never client time

✅ **Timestamp Sources:**

- `created_at: TIMESTAMP NOT NULL DEFAULT NOW()`
- Login time: `NOW()`
- Token expiry: Server-calculated expiry time in JWT
- Account lock duration: `NOW() + INTERVAL '30 minutes'`

❌ **Forbidden:**

- Client timestamps
- Browser time
- Clock from request

#### 7. Structured Logging

**Rule:** ALL logs must be Pino JSON, never console.log

✅ **Required Format:**

```json
{
  "timestamp": "2026-02-17T10:30:00.000Z",
  "level": "info",
  "service": "auth",
  "correlation_id": "uuid",
  "workspace_id": "workspace-1",
  "workspace_slug": "acme-university",
  "user_id": "user-1",
  "event_type": "login_success",
  "result": "SUCCESS"
}
```

❌ **Forbidden:**

- `console.log()`
- Unstructured strings
- Stack trace leakage

---

## Runtime Safety Guarantees

### Isolation Preserved

✅ **Guarantee:** No token from Workspace A can access Workspace B

**Mechanism:**

1. JWT contains `workspace_id`
2. Middleware resolves current workspace context
3. JWT validation compares: `token.workspace_id === resolved.workspace_id`
4. Mismatch → 401 Unauthorized

**Implementation:** API-002 (JWT validation middleware)

### License Enforcement Active

✅ **Guarantee:** SOFT_LOCKED workspaces cannot issue new tokens

**Mechanism:**

1. Login route checks license status
2. ACTIVE → Allow token issuance
3. SOFT_LOCKED → Return 423
4. ARCHIVED → Return 403

**Implementation:** API-004/005 (login routes with license check)

### Snapshot Integrity Preserved

✅ **Guarantee:** Authentication does NOT modify attempt snapshots

**Verification:** No access to attempt tables, no grading, no snapshot mutations

### Concurrency Guarded

✅ **Guarantee:** Concurrent operations don't create race conditions

**Guards:**

- Row locks (FOR UPDATE) on user row during login
- SERIALIZABLE isolation for failed attempt counting
- Atomic token_version increment on logout

**Implementation:** Based on clarify.md QA-1.4, QA-3.2, QA-3.3

### Idempotency Enforced

✅ **Guarantee:** Logout outcome is idempotent

**Mechanism:** token_version increment means old tokens invalid regardless of call count

**Implementation:** API-006/007

### Error Format Standardized

✅ **Guarantee:** All errors follow standard contract

**Format:**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

**Implementation:** API-008 (error handler middleware)

### Logging Structured

✅ **Guarantee:** All logs include correlation_id and workspace context

**Required Fields:**

- timestamp (ISO 8601 UTC)
- level (info/warn/error)
- service (auth)
- correlation_id (UUID)
- workspace_id (tenant context)
- workspace_slug (for debugging)
- user_id (if authenticated)

**Implementation:** OBS-001 (auth logger)

### No Stack Traces Exposed

✅ **Guarantee:** Server errors don't leak stack traces to client

**Mechanism:** Error handler catches exceptions, returns generic error message

**Implementation:** API-008 (error handler converts exceptions to standard contract)

---

## Code Generation Rules

### 1. Follow AGENTS.md Contracts

**Reference:** [AGENTS.md](../../../AGENTS.md)

✅ **Mandatory Compliance:**

- No cross-app imports
- No business logic in frontend
- All DB via tenant resolver
- Router composition (not decorators)

### 2. Follow Lint Rules

**Tools:** ESLint, TypeScript strict mode, Prettier

✅ **Requirements:**

- No `any` types
- No unused variables
- No console.log
- Proper error handling

### 3. Use Validation Package

**Location:** `packages/validation/`

✅ **Validation Implementation:**

- Email format: `z.string().email()`
- Password length: `z.string().min(8).max(256)`
- Input sanitization via Zod schemas

**Implementation:** API-010 (auth schemas)

### 4. Use Shared Types Package

**Location:** `packages/types/auth.ts`

✅ **Type Sharing:**

- LoginRequest, LoginResponse interfaces
- AuthenticatedUser, ErrorResponse types
- Re-used across API and Frontend

**Implementation:** DOMAIN-004 (auth types)

### 5. Respect Layering Boundaries

**Boundary Rules:**

- ✅ API layer: Routes, middleware, HTTP handlers
- ✅ Domain layer: Business logic, validation, crypto
- ✅ Frontend: UI, state management (no business logic)
- ✅ Database: Migrations, seeds, schemas

❌ **Forbidden:**

- Frontend importing domain database functions
- API importing frontend components
- Domain importing HTTP frameworks

### 6. Use shadcn-vue + Tailwind v4 in UI

**Frontend Framework:**

- ✅ Vue 3 composition API
- ✅ shadcn-vue components (Button, Input, Card, Form)
- ✅ Tailwind v4 utilities (spacing, colors, layout)
- ✅ Pinia for state management

**Implementation:** FRONTEND-003 (login page)

### 7. Never Duplicate Logic Across Layers

**Code Reuse Rule:**

- Both API and Frontend use `packages/domain-core/auth/*`
- Password hashing: DOMAIN-001 (not replicated)
- JWT operations: DOMAIN-002 (not replicated)
- RBAC evaluation: DOMAIN-003 (not replicated)

---

## Post-Implementation Checklist

After code generation, verify:

### Routing & Middleware

- [ ] All routes use tenant resolver context
- [ ] Correlation ID middleware applied first
- [ ] License middleware applied before route handler
- [ ] Schema validation middleware present
- [ ] JWT validation on protected routes
- [ ] Error handler catches all exceptions
- [ ] No route bypasses middleware stack

**Implementation:** API-001, API-009

### Transactions & Concurrency

- [ ] Login wrapped in REPEATABLE READ transaction
- [ ] Failed attempt counting in SERIALIZABLE transaction
- [ ] Row locks (FOR UPDATE) on user row
- [ ] Logout wraps token_version update in transaction
- [ ] Rollback paths defined
- [ ] No race conditions

**Implementation:** API-003/004/005/006/007, TEST-006

### Idempotency

- [ ] Logout outcome-idempotent
- [ ] Seed ON CONFLICT DO NOTHING
- [ ] Tests verify idempotency
- [ ] No duplicate tokens from logout

**Implementation:** API-006/007, INFRA-003, TEST-005

### Version Enforcement

- [ ] schema_version in JWT
- [ ] product_version in JWT
- [ ] JWT validation checks versions
- [ ] 426 error on mismatch
- [ ] Tests verify version compatibility

**Implementation:** API-002, API-004/005, TEST-009

### Logging

- [ ] All auth events logged
- [ ] Logs include correlation_id
- [ ] Logs include workspace_id and workspace_slug
- [ ] No console.log anywhere
- [ ] No stack traces in logs
- [ ] Pino JSON format

**Implementation:** OBS-001, all API routes

### Security

- [ ] Email enumeration protected (dummy hash)
- [ ] RBAC enforced server-side
- [ ] JWT workspace scope validated
- [ ] Password hashing uses bcrypt 12 rounds
- [ ] Account lock after 5 failures in 15 min
- [ ] SQL injection prevented (Drizzle ORM)
- [ ] XSS protected (Vue escaping)
- [ ] CORS configured

**Implementation:** SEC-001/002/003/004/005, API-003/004/005

### Testing

- [ ] Unit tests for password hashing
- [ ] Unit tests for JWT operations
- [ ] Unit tests for RBAC evaluation
- [ ] Integration tests for login flow
- [ ] Integration tests for logout flow
- [ ] Integration tests for concurrency
- [ ] Integration tests for error contract
- [ ] Integration tests for audit logging
- [ ] Integration tests for version enforcement
- [ ] Isolation tests for workspace boundary
- [ ] Isolation tests for division boundary

**Implementation:** TEST-001 through TEST-011

### No TODOs Left

- [ ] All code complete (no // TODO comments)
- [ ] All imports resolved
- [ ] No console.log statements
- [ ] No hardcoded credentials
- [ ] No debug code

---

## Final Implementation Declaration

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                    IMPLEMENTATION GATE CONFIRMATION                         ║
║                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                        ║
║                                                                              ║
║  Stage: STAGE_03_AUTHENTICATION_SYSTEM (Phase 1)                            ║
║  Date: 2026-02-17                                                            ║
║                                                                              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                              ║
║  GATE VALIDATIONS:                                                           ║
║  ✅ Analyze step passed (ZERO violations)                                   ║
║  ✅ Constitutional compliance confirmed                                     ║
║  ✅ All ambiguities resolved (24/24 completed)                              ║
║  ✅ Execution scope defined (clear boundaries)                              ║
║  ✅ Constraints established (tenant resolver, transactions, logging)        ║
║  ✅ Runtime safety guarantees defined (isolation, license, idempotency)    ║
║  ✅ Code generation rules set (validation, types, no duplication)          ║
║  ✅ Post-implementation checklist ready                                     ║
║                                                                              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                              ║
║  ✅ IMPLEMENTATION GATE PASSED                                              ║
║                                                                              ║
║  Implementation compliant with Zidney Constitution v1.2.0                  ║
║  Safety guarantees preserved.                                              ║
║                                                                              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                                                              ║
║  NEXT STEPS:                                                                 ║
║  1. Assign tasks (tasks.md) to team members                                 ║
║  2. Execute in dependency order (INFRA → DOMAIN → API → FE → OBS → TEST)  ║
║  3. Run all tests before merge                                             ║
║  4. Follow post-implementation checklist                                   ║
║  5. Merge to develop when complete                                         ║
║                                                                              ║
║  Status: 🟢 READY FOR IMPLEMENTATION                                        ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Next Steps for Team

### Phase: Execution (Step 6 of SpecKit Hard Mode Workflow)

1. **Task Assignment** (Today)
   - Assign 46 tasks from `tasks.md` to team members
   - Group by category (Infrastructure, Domain, API, Frontend, Observability, Testing)
   - Assign 2-3 developers per category for parallelization

2. **Dependency Chain Execution**

   ```
   INFRASTRUCTURE (5 tasks)
        ↓
   DOMAIN (4 tasks)
        ↓
   API (11 tasks) + FRONTEND (4 tasks) [parallel]
        ↓
   OBSERVABILITY (3 tasks)
        ↓
   TESTING (11 tasks)
        ↓
   SECURITY (5 tasks)
        ↓
   DEPLOYMENT (3 tasks)
   ```

3. **Code Review** (Per task)
   - Reference this gate document
   - Verify post-implementation checklist
   - Ensure no violations to AGENTS.md
   - Confirm transaction safety
   - Validate error handling

4. **Testing** (Final)
   - All 11 integration tests must pass
   - Concurrency tests must verify no race conditions
   - Isolation tests must verify workspace boundaries
   - Version enforcement tests must verify SemVer
   - Audit logging tests must verify structured logs

5. **Final Validation**
   - Run `lint` + `type-check` + `test` + `build`
   - Verify no console.log in production code
   - Confirm no TODO comments
   - Validate environment variables

6. **Merge to develop**
   - All checks pass
   - All tests pass
   - Post-implementation checklist complete
   - Ready for Phase 2 stages

---

**Implementer:** Zidney Implementation Gate  
**Authority:** Zidney Constitution v1.2.0, SpecKit Hard Mode Workflow  
**Status:** ✅ GATE PASSED — READY FOR IMPLEMENTATION
