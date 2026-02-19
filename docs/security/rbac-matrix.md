# Role-Based Access Control (RBAC) Matrix

**STAGE 08 - Rate Limiting & Security Baseline**

## Role Definitions

| Role            | Level | Description                      | Permissions                                           |
| --------------- | ----- | -------------------------------- | ----------------------------------------------------- |
| **student**     | 1     | Student attempting exams         | Take attempt, view own results, WebSocket monitoring  |
| **proctor**     | 2     | Exam proctor monitoring students | Monitor attempts, view student results, report issues |
| **admin**       | 3     | Workspace administrator          | Manage DLQ, view audit logs, moderate users           |
| **org_admin**   | 4     | Organization administrator       | Cross-workspace management, system configuration      |
| **super_admin** | 5     | System administrator             | Full platform access (rarely used)                    |

## Endpoint Access Matrix

### Authentication Endpoints

| Endpoint               | Method | Student | Proctor | Admin | Org Admin | Super Admin | Notes                     |
| ---------------------- | ------ | ------- | ------- | ----- | --------- | ----------- | ------------------------- |
| `/auth/login`          | POST   | ✅      | ✅      | ✅    | ✅        | ✅          | Public (no auth required) |
| `/auth/logout`         | POST   | ✅      | ✅      | ✅    | ✅        | ✅          | Requires valid JWT        |
| `/auth/password-reset` | POST   | ✅      | ✅      | ✅    | ✅        | ✅          | Public (email-based)      |

### Attempt Lifecycle Endpoints

| Endpoint               | Method | Student | Proctor | Admin | Org Admin | Notes                                   |
| ---------------------- | ------ | ------- | ------- | ----- | --------- | --------------------------------------- |
| `/attempt`             | POST   | ✅      | ❌      | ❌    | ❌        | Create/start new attempt                |
| `/attempt/{id}`        | GET    | ✅\*    | ✅      | ✅    | ✅        | Get attempt details (\*own only)        |
| `/attempt/{id}/submit` | POST   | ✅\*    | ❌      | ❌    | ❌        | Submit answers (\*own attempt)          |
| `/attempt/{id}/status` | GET    | ✅\*    | ✅      | ✅    | ✅        | Get attempt status (\*own or proctored) |
| `/attempt/{id}/result` | GET    | ✅\*    | ✅      | ✅    | ✅        | Get grading result (\*own or proctored) |

### WebSocket Endpoints

| Endpoint           | Method | Student | Proctor | Admin | Org Admin | Notes                                   |
| ------------------ | ------ | ------- | ------- | ----- | --------- | --------------------------------------- |
| `/ws/attempt/{id}` | WS     | ✅\*    | ✅      | ❌    | ❌        | Real-time updates (\*own or proctoring) |

### Admin Endpoints

| Endpoint                                    | Method | Student | Proctor | Admin | Org Admin | Super Admin | Notes                      |
| ------------------------------------------- | ------ | ------- | ------- | ----- | --------- | ----------- | -------------------------- |
| `/admin/workspace/{id}/dlq`                 | GET    | ❌      | ❌      | ✅    | ✅        | ✅          | List DLQ jobs              |
| `/admin/workspace/{id}/dlq/{dlqId}/retry`   | POST   | ❌      | ❌      | ✅    | ✅        | ✅          | Retry DLQ job              |
| `/admin/workspace/{id}/dlq/{dlqId}/discard` | POST   | ❌      | ❌      | ✅    | ✅        | ✅          | Discard DLQ job            |
| `/admin/workspace/{id}/rate-limit-audit`    | GET    | ❌      | ❌      | ✅    | ✅        | ✅          | View rate limit violations |

### Symbols

- ✅ = Allowed
- ❌ = Denied
- \* = Conditional (additional checks required)

## Special Rules

### Rule 1: Student Can Only Access Own Attempts

```typescript
// Middleware enforcement:
if (userRole === 'student') {
  const requestedAttemptId = req.params.attempt_id
  const attemptData = await db.query(
    'SELECT user_id FROM attempts WHERE id = ?',
    requestedAttemptId
  )

  if (attemptData.user_id !== currentUserId) {
    return 403 FORBIDDEN // Cross-user access blocked
  }
}
```

### Rule 2: Proctor Can Access Students Under Their Supervision

```typescript
if (userRole === 'proctor') {
  const requestedAttemptId = req.params.attempt_id
  const attemptData = await db.query(
    'SELECT proctor_id FROM attempts WHERE id = ?',
    requestedAttemptId
  )

  if (attemptData.proctor_id !== currentUserId) {
    return 403 FORBIDDEN // Can't access other proctor's students
  }
}
```

### Rule 3: Admin Limited to Own Workspace

```typescript
if (userRole === 'admin') {
  const requestedWorkspaceId = req.params.workspace_id

  if (requestedWorkspaceId !== userContext.workspace_id) {
    return 403 FORBIDDEN // Cross-workspace access blocked
  }
}
```

### Rule 4: Org Admin Can Cross Workspaces

```typescript
if (userRole === 'org_admin') {
  // Can access any workspace within same organization
  const requestedWorkspaceId = req.params.workspace_id
  const workspace = await db.query(
    'SELECT org_id FROM workspaces WHERE id = ?',
    requestedWorkspaceId
  )

  if (workspace.org_id !== userContext.org_id) {
    return 403 FORBIDDEN // Cross-org access blocked
  }
}
```

## RBAC Enforcement Points

### 1. Middleware Layer (First Line of Defense)

```typescript
// File: apps/api/src/middleware/rbac.ts

middleware.use(async (c, next) => {
  const endpoint = c.req.path
  const method = c.req.method
  const userRoles = extractRolesFromJWT(c)

  const allowedRoles = getEndpointRoles(endpoint, method)

  const hasPermission = userRoles.some((role) => allowedRoles.includes(role))

  if (!hasPermission) {
    // Log RBAC denial
    logger.warn({
      event: 'rbac_denial',
      endpoint,
      user_id: c.state.userId,
      user_roles: userRoles,
      required_roles: allowedRoles,
      correlation_id: c.state.correlationId,
    })

    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          correlationId: c.state.correlationId,
        },
      },
      403
    )
  }

  await next()
})
```

### 2. Route Handler Layer (Business Logic)

```typescript
// File: apps/api/src/modules/attempt/handlers.ts

export async function getAttempt(c: Context) {
  const attemptId = c.req.param('id')
  const userId = c.state.user_id
  const userRole = c.state.roles[0]

  const attempt = await db.query(
    'SELECT * FROM attempts WHERE id = ?',
    attemptId
  )

  // Additional ownership check for students
  if (userRole === 'student' && attempt.user_id !== userId) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: "Cannot access other user's attempt",
        },
      },
      403
    )
  }

  // Proctor checks their supervision relationship
  if (userRole === 'proctor' && attempt.proctor_id !== userId) {
    logger.warn({
      event: 'proctor_unauthorized_access',
      attempt_id: attemptId,
      proctor_id: userId,
      assigned_proctor: attempt.proctor_id,
    })
    return c.json({ success: false, error: { code: 'FORBIDDEN' } }, 403)
  }

  return c.json({ success: true, data: attempt })
}
```

### 3. Database Layer (Final Enforcement)

```typescript
// File: apps/api/src/db/tenant/queries/attempt.ts

export async function getAttemptWithRBAC(
  attemptId: string,
  userId: string,
  userRole: 'student' | 'proctor' | 'admin'
): Promise<Attempt | null> {
  if (userRole === 'student') {
    // Only own attempts
    return await db.query(
      'SELECT * FROM attempts WHERE id = ? AND user_id = ?',
      [attemptId, userId]
    )
  } else if (userRole === 'proctor') {
    // Proctored students
    return await db.query(
      'SELECT * FROM attempts WHERE id = ? AND proctor_id = ?',
      [attemptId, userId]
    )
  } else if (userRole === 'admin') {
    // All workspace attempts
    return await db.query('SELECT * FROM attempts WHERE id = ?', [attemptId])
  }
}
```

### 4. Audit Trail

All RBAC decisions logged:

```json
{
  "timestamp": "2026-02-19T10:30:45Z",
  "level": "info",
  "service": "api",
  "event": "rbac_check",
  "correlation_id": "req-123",
  "workspace_id": "ws-456",
  "user_id": "user-789",
  "user_roles": ["student"],
  "endpoint": "GET /attempt/att-111",
  "decision": "ALLOWED",
  "reason": "owner_check_passed"
}
```

## JWT Claims Structure

```json
{
  "sub": "user-123",
  "user_id": "user-123",
  "email": "student@example.com",
  "workspace_id": "ws-456",
  "workspace_slug": "acme-university",
  "org_id": "org-789",
  "roles": ["student"],
  "exp": 1708363845,
  "iat": 1708360245,
  "jti": "jwt-token-id"
}
```

## Adding New Roles

### Step 1: Define Role in Enum

```typescript
// File: packages/types/src/roles.ts
export enum UserRole {
  STUDENT = 'student',
  PROCTOR = 'proctor',
  ADMIN = 'admin',
  ORG_ADMIN = 'org_admin',
  SUPER_ADMIN = 'super_admin',
  // NEW_ROLE = 'new_role'  // Add here
}
```

### Step 2: Define Endpoint Permissions

```typescript
// File: apps/api/src/config/rbac-config.ts
const endpointRoles = {
  'GET /admin/workspace/{id}/new-endpoint': ['admin', 'org_admin'],
  // Or new_role if needed
}
```

### Step 3: Add Conditional Checks

```typescript
// File: apps/api/src/modules/*/handler.ts
if (userRole === 'new_role') {
  // Handle new role logic
}
```

### Step 4: Update Tests

```typescript
// File: apps/api/tests/unit/rbac.test.ts
it('should allow new_role to access endpoint', () => {
  const result = enforcer.checkPermission(
    {
      roles: ['new_role'],
      endpoint: '...',
    },
    allowedRoles
  )

  expect(result.allowed).toBe(true)
})
```

### Step 5: Update Documentation

Add new role to matrix above with permission details.

## Troubleshooting RBAC Issues

### Issue: "Insufficient Permissions" on Valid Request

**Diagnosis:**

1. Check JWT roles claim:

   ```bash
   jwt_decode() {
     jq -R 'split(".") | .[1] | @base64d | fromjson' <<< "$1"
   }
   jwt_decode $YOUR_JWT_TOKEN | jq .roles
   ```

2. Verify endpoint configuration:

   ```bash
   SELECT endpoint, allowed_roles FROM rbac_config WHERE endpoint = '...';
   ```

3. Check middleware execution order (RBAC should run after JWT validation)

### Issue: Students Can Access Other Attempts

**Verification:**

```bash
# Check ownership validation in handler
grep -n "user_id !== userId" apps/api/src/modules/attempt/handlers.ts

# Should show check at route handler level
```

### Issue: Cross-Workspace Admin Access

**Check:**

```bash
# Verify workspace isolation middleware
curl -H "Authorization: Bearer $JWT_WORKSPACE_A" \
  https://api.zidney.example.com/admin/workspace/ws-b/dlq

# Should return 403 FORBIDDEN
```

## Migration Notes

Changing an endpoint's permissions:

1. **Plan deprecation:** Announce change 2 weeks ahead
2. **Gradual rollout:** Use feature flag if adding restrictions
3. **Update tests:** Ensure new permissions tested
4. **Audit logs:** Monitor for affected users
5. **Support ready:** Brief support team on changes

## References

- [OWASP RBAC](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Zero Trust Security](https://www.nist.gov/publications/zero-trust-architecture)
