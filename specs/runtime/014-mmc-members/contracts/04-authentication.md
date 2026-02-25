# API Contract — Authentication & Permissions

## Overview

Authentication and permission verification endpoints handle MMC member login, JWT issuance, session management via token versioning, and permission querying for UI optimization.

---

## POST /mmc/auth/login

**Authenticate & Issue JWT** — Validates credentials, checks account status, issues access token

### Permissions

- None (public endpoint)

### Rate Limiting

- **Limit:** 5 failed login attempts per minute per IP
- **Lockout:** 1 hour after 6th failure
- **Response on limit:** 429 Too Many Requests

### Request

```
POST /mmc/auth/login
Content-Type: application/json
X-Forwarded-For: 203.0.113.45 (optional; IP detection)

{
  "username": "john.doe",
  "password": "SecurePassword123!"
}
```

### Request Validation

| Field | Type | Constraints |
| --- | --- | --- |
| username | string | Alphanumeric + underscore; case-sensitive |
| password | string | Any length; plaintext |

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtZW1iZXItdXVpZCIsImV4cCI6MTc0MDQ5MzQwMCwidG9rZW5fdmVyc2lvbiI6MSwicm9sZV9pZCI6InJvbGUtdXVpZCIsImlzc3VlciI6Im1tYyJ9.signature",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": "member-uuid",
      "username": "john.doe",
      "email": "john.doe@example.com",
      "role_id": "role-uuid",
      "role_name": "Platform Administrator"
    }
  },
  "error": null
}
```

### JWT Claims (in issued token)

| Claim | Value | Description |
| --- | --- | --- |
| sub | member UUID | Subject (user ID) |
| issuer | "mmc" | Token issuer (always "mmc" for MMC auth) |
| role_id | UUID | Member's current role |
| token_version | integer | Current token_version from DB; used for session invalidation |
| exp | timestamp | Expiration (unix seconds); typically NOW + 3600 |

**Important:** Token NEVER contains `workspace_id`. If token received by tenant endpoint with workspace_id, it's a cross-context rejection.

### Error Responses

#### 400 Bad Request
**Validation Error**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Missing username or password"
  }
}
```

#### 401 Unauthorized
**Invalid Credentials** (generic; doesn't distinguish user vs password failure for security)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid username or password"
  }
}
```

Account Disabled:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Account has been disabled. Contact an administrator."
  }
}
```

#### 429 Too Many Requests
**Rate Limit Exceeded**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many login attempts. Try again in 1 hour."
  }
}
```

### Login Logic (Pseudocode)

```python
def login(username, password, client_ip, correlation_id):
    # 1. Rate limit check (per IP, failed attempts)
    rate_key = f"mmc:login_attempts:{client_ip}"
    attempts = redis.get(rate_key) or 0
    if attempts >= 5:
        log.warn('login_rate_limit', ip=client_ip, status=429)
        return 429 'Rate limited'
    
    # 2. Fetch member
    db = get_master_pool()
    member = await db.query_one('''
        SELECT id, password_hash, status, role_id, token_version 
        FROM mmc_members WHERE username = ?
    ''', [username])
    
    # 3. Check exists
    if not member:
        redis.incr(rate_key)
        redis.expire(rate_key, 60)  # 1 min expiry
        log.warn('login_fail_not_found', username=username, correlation_id=correlation_id)
        await audit_log('LOGIN_ATTEMPT_FAILED', correlation_id=correlation_id)
        return 401 'Invalid username or password'
    
    # 4. Check status
    if member.status != 'ACTIVE':
        log.warn('login_fail_disabled', username=username, correlation_id=correlation_id)
        return 401 'Account disabled'
    
    # 5. Verify password
    if not bcrypt.verify(password, member.password_hash):
        redis.incr(rate_key)
        redis.expire(rate_key, 60)
        log.warn('login_fail_password', username=username, correlation_id=correlation_id)
        await audit_log('LOGIN_ATTEMPT_FAILED', correlation_id=correlation_id)
        return 401 'Invalid username or password'
    
    # 6. Increment success counter and reset failure counter
    redis.delete(rate_key)  # Clear failed attempts
    
    # 7. Issue JWT
    token = jwt.sign({
        'sub': member.id,
        'issuer': 'mmc',
        'role_id': member.role_id,
        'token_version': member.token_version,
        'exp': time.now() + 3600
    }, secret=JWT_SECRET, algorithm='HS256')
    
    # 8. Log success
    log.info('login_success', username=username, member_id=member.id, correlation_id=correlation_id)
    await audit_log('LOGIN_ATTEMPT_SUCCESS', actor=member.id, correlation_id=correlation_id)
    
    # 9. Return token
    return 200 {
        'access_token': token,
        'token_type': 'Bearer',
        'expires_in': 3600,
        'user': {
            'id': member.id,
            'username': username,
            'email': member.email,
            'role_id': member.role_id
        }
    }
```

### Token Usage (in subsequent requests)

All `/mmc/*` routes require token in Authorization header:

```
GET /mmc/members/uuid
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
X-Correlation-ID: correlation-uuid
```

Middleware:
1. Extracts JWT from header
2. Verifies signature
3. Checks token_version against DB
4. Rejects if token_version mismatch (session invalidated)

---

## POST /mmc/auth/logout

**Logout & Invalidate Session** (optional; can defer)

### Permissions

- Authenticated only

### Request

```
POST /mmc/auth/logout
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "error": null
}
```

### Server-Side Behavior

- Log logout event to audit trail
- No token revocation needed (stateless JWT)
- Client discards token on next page load

---

## GET /mmc/permissions/check

**Check Permissions for Current User** — Returns permission matrix for queried domains

### Permissions

- Authenticated only (no role-based check; user can query own permissions)

### Request

```
GET /mmc/permissions/check?domains=PRODUCT_MANAGEMENT,CLIENT_MANAGEMENT
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Query Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| domains | string (comma-separated) | Domains to check; e.g., "PRODUCT_MANAGEMENT,CLIENT_MANAGEMENT" |

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "user_id": "member-uuid",
    "role_id": "role-uuid",
    "role_name": "Platform Administrator",
    "permissions": {
      "PRODUCT_MANAGEMENT": {
        "can_view": true,
        "can_create": true,
        "can_edit": true,
        "can_delete": true
      },
      "CLIENT_MANAGEMENT": {
        "can_view": true,
        "can_create": true,
        "can_edit": true,
        "can_delete": false
      }
    }
  },
  "error": null
}
```

### Use Case

Frontend calls this once after login to cache permission state; uses for:
- Hiding/showing menu items (UX optimization only)
- Disabling buttons for actions user cannot perform
- **NOT** for security enforcement (API still enforces permissions)

### Query Logic

```sql
SELECT (can_view, can_create, can_edit, can_delete) FROM role_permissions
WHERE role_id = ? AND domain IN (?, ?, ...)
```

### Error Responses

#### 400 Bad Request
**No domains specified**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Specify at least one domain"
  }
}
```

#### 401 Unauthorized
**Invalid or expired token**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

---

## GET /mmc/auth/me

**Get Current User Details** (convenience endpoint)

### Permissions

- Authenticated only

### Request

```
GET /mmc/auth/me
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "member-uuid",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "role_id": "role-uuid",
    "role_name": "Platform Administrator",
    "status": "ACTIVE",
    "token_version": 1
  },
  "error": null
}
```

---

## Session Invalidation (Token Version Cascade)

### When Token Version Changes

Token version incremented in following scenarios:

1. **Member Disabled:** Admin disables member account
   - `DELETE /mmc/members/:id` → increments token_version
   - Next request with old token fails 401

2. **Role Permissions Changed:** Admin edits role permissions
   - `PATCH /mmc/roles/:id/permissions` → increments token_version for all members with that role
   - All affected members' sessions invalidated immediately

3. **Manual Session Reset:** Admin explicitly resets member's session (future feature)
   - `POST /mmc/members/:id/reset-session` → increments token_version

### Session Invalidation Flow

```
Scenario: Admin edits role permissions affecting user A

1. Admin calls: PATCH /mmc/roles/{id}/permissions
2. API updates permissions (role_permissions table)
3. API finds all members with this role: [User A, User B, ...]
4. API increments token_version for each: e.g., 5 → 6
5. DB transaction commits atomically

6. User A has active session with JWT.token_version = 5
7. User A's browser makes next request: GET /mmc/members

8. Auth middleware:
   - Extracts JWT: token_version = 5
   - Queries DB for User A: token_version = 6
   - Detects mismatch: 5 ≠ 6
   - Returns 401 Unauthorized

9. User A's browser catches 401
10. Browser shows: "Please log in again"
11. User A logs in again
12. New JWT issued with token_version = 6
13. Session continues with new token
```

---

## Cross-Context Token Rejection

### Enforcement at Authentication Middleware

**Rule:** MMC endpoints reject tokens containing `workspace_id`.

```python
def mmc_auth_middleware(request):
    # Extract JWT
    token = extract_jwt(request)
    
    # Verify signature
    payload = jwt.verify(token)
    
    # CRITICAL CHECK: Reject cross-context tokens
    if 'workspace_id' in payload and payload.get('workspace_id'):
        log.warn('cross_context_token_rejected', 
                 workspace_id=payload['workspace_id'], 
                 status=401)
        return 401 'Unauthorized'
    
    # Continue (token is MMC scope only)
    return next()
```

**Rationale:** MMC token issued by MMC issuer; if it contains workspace_id, it's a tenant token being misused. Reject immediately.

---

## JWT Structure (Detailed)

### Issued JWT (Example)

```
Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",  // user ID
  "issuer": "mmc",                                 // always "mmc"
  "role_id": "role-uuuu-1234",                     // current role
  "token_version": 1,                              // session version
  "exp": 1740493400,                               // expiration (unix seconds)
  "iat": 1740489800                                // issued at
}

Signature: HMACSHA256(base64(header) + "." + base64(payload), JWT_SECRET)
```

### Payload Fields Explained

| Field | Purpose | Used For |
| --- | --- | --- |
| sub | User identity | Fetch member record for auth checks |
| issuer | Token source | Distinguish MMC from tenant tokens |
| role_id | Authorization context | Fetch permission matrix |
| token_version | Session version | Detect session invalidation |
| exp | Expiration | Check if token expired |
| iat | Issuance time | Audit trail (when token issued) |

