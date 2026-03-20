---
name: api-testing-patterns
description: Multi-tenant API integration testing patterns including tenant isolation assertions, RBAC testing, and idempotency validation
metadata:
  category: testing
  scope: api
  capabilities:
    - multi-tenant test setup
    - tenant isolation assertions
    - RBAC negative testing
    - idempotency replay testing
    - test data factory patterns
---

# API Testing Patterns Skill

Zidney's database-per-tenant architecture requires specialized testing patterns. This skill defines integration test standards for the API layer.

---

## Test Environment Setup

```typescript
import { createTestTenant } from '@zidney/test-utils';
import { createTestUser } from '@zidney/test-utils';

// Each test suite gets its own isolated tenant
const tenant = await createTestTenant({ slug: 'test-tenant-001' });
const admin = await createTestUser(tenant, { role: 'admin' });
const student = await createTestUser(tenant, { role: 'student' });
```

Rules:
- Each test suite creates its own tenant database
- Test tenants are cleaned up after tests complete
- Never share test tenants across test files
- Use dynamic slugs to prevent collisions in parallel test runs

---

## Tenant Isolation Assertions

Every API endpoint test MUST verify that Tenant A cannot access Tenant B data:

```typescript
describe('GET /api/exams/:id', () => {
  it('returns 404 for exam belonging to different tenant', async () => {
    const tenantA = await createTestTenant({ slug: 'tenant-a' });
    const tenantB = await createTestTenant({ slug: 'tenant-b' });
    
    const exam = await createExam(tenantA);
    
    const response = await api
      .get(`/api/exams/${exam.id}`)
      .withTenant(tenantB)
      .withAuth(tenantB.admin);
    
    expect(response.status).toBe(404);
  });
});
```

---

## RBAC Negative Testing

For every protected endpoint, test that unauthorized roles are rejected:

```typescript
const rbacMatrix = [
  { role: 'student', endpoint: 'POST /api/exams', expected: 403 },
  { role: 'student', endpoint: 'DELETE /api/exams/:id', expected: 403 },
  { role: 'instructor', endpoint: 'DELETE /api/workspace', expected: 403 },
];

rbacMatrix.forEach(({ role, endpoint, expected }) => {
  it(`${role} receives ${expected} on ${endpoint}`, async () => {
    // Test implementation
  });
});
```

---

## Idempotency Replay Testing

Submission endpoints MUST be tested for idempotent behavior:

```typescript
describe('POST /api/attempts/:id/submit', () => {
  it('produces identical result when submitted twice', async () => {
    const attempt = await createAttempt(tenant, student);
    const payload = buildSubmission(attempt);
    
    const first = await api.post(`/api/attempts/${attempt.id}/submit`, payload);
    const second = await api.post(`/api/attempts/${attempt.id}/submit`, payload);
    
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data).toEqual(first.body.data);
  });
});
```

---

## Error Response Validation

All API tests must validate the standard error format:

```typescript
expect(response.body).toMatchObject({
  success: false,
  data: null,
  error: {
    code: expect.any(String),
    message: expect.any(String),
  },
});
```

---

## License Middleware Testing

```typescript
describe('License enforcement', () => {
  it('returns 423 for SOFT_LOCKED workspace', async () => {
    const tenant = await createTestTenant({ licenseStatus: 'SOFT_LOCKED' });
    const response = await api.get('/api/exams').withTenant(tenant);
    expect(response.status).toBe(423);
  });

  it('returns 403 for ARCHIVED workspace', async () => {
    const tenant = await createTestTenant({ licenseStatus: 'ARCHIVED' });
    const response = await api.get('/api/exams').withTenant(tenant);
    expect(response.status).toBe(403);
  });
});
```

---

## Test Data Factories

Standard factory functions for test data:

- `createTestTenant(overrides?)` — creates isolated tenant with database
- `createTestUser(tenant, overrides?)` — creates user in tenant scope
- `createExam(tenant, overrides?)` — creates exam with default config
- `createAttempt(tenant, user, exam?)` — creates attempt with snapshot
- `buildSubmission(attempt)` — builds valid submission payload

All factories must:
- Accept partial overrides for customization
- Generate unique IDs automatically
- Clean up on test teardown

---

## Test Naming Convention

```
describe('<HTTP Method> <path>')
  it('<action> when <condition>')
```

Example: `describe('POST /api/exams') → it('creates exam when admin is authenticated')`

---

## Verdict Protocol

```
VERDICT: PASS   — tests cover isolation, RBAC, and idempotency
VERDICT: BLOCKED — missing tenant isolation or RBAC negative tests
```
