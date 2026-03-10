# API Contract — Invitations & Onboarding

## Overview

Invitation endpoints handle one-time token-based member onboarding: invitation creation, expiration
enforcement, and account creation on acceptance.

---

## POST /mmc/invitations

**Send Invitation** — Generates one-time token, sends email to member

### Permissions

- Required: `MEMBERS_MANAGEMENT.create`
- Denied returns: 403 Forbidden

### Request

```
POST /mmc/invitations
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
Content-Type: application/json

{
  "email": "newuser@example.com",
  "role_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Request Validation

| Field   | Type   | Constraints                                       |
| ------- | ------ | ------------------------------------------------- |
| email   | string | Valid email format; must not exist in mmc_members |
| role_id | UUID   | Must exist in roles table and status='ACTIVE'     |

### Response: 201 Created

```json
{
  "success": true,
  "data": {
    "id": "invitation-uuid",
    "email": "newuser@example.com",
    "role_id": "550e8400-e29b-41d4-a716-446655440000",
    "role_name": "Platform Administrator",
    "status": "PENDING",
    "expires_at": "2026-02-26T10:30:00.000Z",
    "created_at": "2026-02-25T10:30:00.000Z",
    "message": "Invitation sent to newuser@example.com"
  },
  "error": null
}
```

### Email Sending

**Sent asynchronously (does not block response):**

```
To: newuser@example.com
Subject: You're invited to Zidney Platform

Hi,

You've been invited to join the Zidney Platform as a Platform Administrator.

To accept this invitation and create your account, click the link below:
https://mmc.zidney.example.com/invitations/accept?token={plaintext_token}

This link expires on: 2026-02-26 10:30:00 UTC (24 hours)

If you did not expect this invitation, please ignore this email.

Best regards,
Zidney Admin Team
```

### Error Responses

#### 400 Bad Request

**Validation Error**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Invalid email format"
  }
}
```

#### 409 Conflict

**Email already an MMC member or pending invite**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "Email 'newuser@example.com' is already an MMC member"
  }
}
```

Or pending:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "Invitation already sent to 'newuser@example.com'; expires on 2026-02-26T10:30:00.000Z"
  }
}
```

### Transaction Details

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Verify email not in mmc_members
  2. Verify email not pending (or cancel old invitation)
  3. Verify role_id exists and status='ACTIVE'
  4. Generate token (32 bytes random)
  5. Hash token (SHA256)
  6. INSERT into mmc_member_invitations
  7. INSERT into mmc_audit_log (action=INVITATION_SENT)
COMMIT
```

---

## POST /mmc/invitations/:token/accept

**Accept Invitation & Create Account** — Validates one-time token, creates member with password

### Permissions

- None (public endpoint; token validation required)

### Request

```
POST /mmc/invitations/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/accept
Content-Type: application/json

{
  "password": "MyNewPassword123!",
  "confirmation_password": "MyNewPassword123!"
}
```

### Request Validation

| Field                 | Type   | Constraints                            |
| --------------------- | ------ | -------------------------------------- |
| password              | string | 8+ chars; upper, lower, digit, special |
| confirmation_password | string | Must match password exactly            |

### Response: 201 Created

```json
{
  "success": true,
  "data": {
    "member_id": "member-new-uuid",
    "username": "user_a7f8c2d1",
    "email": "newuser@example.com",
    "role_id": "role-uuid",
    "role_name": "Platform Administrator",
    "status": "ACTIVE",
    "created_at": "2026-02-25T10:31:00.000Z",
    "message": "Account created successfully. You can now login."
  },
  "error": null
}
```

### Login Instructions (in response message or separate endpoint)

User can then login at:

- Endpoint: `POST /mmc/auth/login`
- Credentials: `username: user_a7f8c2d1`, `password: MyNewPassword123!`

### Error Responses

#### 400 Bad Request

**Password validation failed**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Password must contain uppercase, lowercase, digit, and special character"
  }
}
```

Or password mismatch:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Passwords do not match"
  }
}
```

#### 401 Unauthorized

**Token invalid, expired, or already used**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invitation link expired or invalid. Please request a new invitation."
  }
}
```

#### 409 Conflict

**Email already has an account**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "Email already registered as an MMC member"
  }
}
```

### Transaction Details

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Query: SELECT * FROM mmc_member_invitations WHERE token_hash = SHA256(token)
  2. Validate: status='PENDING' AND expires_at > NOW()
  3. If invalid: ROLLBACK, return 401
  4. Hash password (bcrypt, cost=12)
  5. Generate username (from email prefix + random suffix)
  6. Verify username unique
  7. INSERT into mmc_members
  8. UPDATE mmc_member_invitations SET status='ACCEPTED', accepted_at=NOW()
  9. INSERT into mmc_audit_log (action=INVITATION_ACCEPTED)
COMMIT
```

**Idempotency:** Token can only be accepted once; re-submission fails with 401 (status no longer
PENDING).

---

## GET /mmc/invitations

**List All Invitations** (filtered by status)

### Permissions

- Required: `MEMBERS_MANAGEMENT.view`

### Request

```
GET /mmc/invitations?status=PENDING&limit=50&offset=0
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Query Parameters

| Parameter | Type    | Default | Description                                   |
| --------- | ------- | ------- | --------------------------------------------- |
| status    | string  | PENDING | Filter by status (PENDING, ACCEPTED, EXPIRED) |
| limit     | integer | 50      | Results per page                              |
| offset    | integer | 0       | Pagination offset                             |

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "invitations": [
      {
        "id": "invitation-1-uuid",
        "email": "newuser@example.com",
        "role_name": "Platform Administrator",
        "status": "PENDING",
        "expires_at": "2026-02-26T10:30:00.000Z",
        "invited_by_username": "admin.user",
        "created_at": "2026-02-25T10:30:00.000Z"
      },
      {
        "id": "invitation-2-uuid",
        "email": "anothernew@example.com",
        "role_name": "Sales Team",
        "status": "ACCEPTED",
        "accepted_at": "2026-02-25T11:00:00.000Z",
        "invited_by_username": "admin.user",
        "created_at": "2026-02-24T16:00:00.000Z"
      }
    ],
    "total": 18,
    "limit": 50,
    "offset": 0
  },
  "error": null
}
```

---

## GET /mmc/invitations/:id

**Retrieve Invitation Details**

### Permissions

- Required: `MEMBERS_MANAGEMENT.view`

### Request

```
GET /mmc/invitations/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "newuser@example.com",
    "role_id": "role-uuid",
    "role_name": "Platform Administrator",
    "status": "PENDING",
    "expires_at": "2026-02-26T10:30:00.000Z",
    "created_at": "2026-02-25T10:30:00.000Z",
    "invited_by_username": "admin.user"
  },
  "error": null
}
```

---

## POST /mmc/invitations/:id/resend

**Resend Invitation** — Generate new one-time token

### Permissions

- Required: `MEMBERS_MANAGEMENT.create`

### Request

```
POST /mmc/invitations/550e8400-e29b-41d4-a716-446655440000/resend
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "invitation-uuid",
    "email": "newuser@example.com",
    "status": "PENDING",
    "expires_at": "2026-02-26T11:45:00.000Z",
    "message": "New invitation link sent to newuser@example.com"
  },
  "error": null
}
```

### Error Responses

#### 404 Not Found

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Invitation not found"
  }
}
```

#### 409 Conflict

**Cannot resend already-accepted invitation**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "Invitation already accepted; cannot resend"
  }
}
```

### Transaction Details

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Verify invitation exists
  2. Verify status='PENDING' (or reject if ACCEPTED/EXPIRED)
  3. Generate new token
  4. Hash token (SHA256)
  5. UPDATE mmc_member_invitations SET token_hash = ?
  6. INSERT into mmc_audit_log (action=INVITATION_RESENT)
COMMIT
```

---

## Invitation Workflow State Machine

```
            ┌────────────────┐
            │ Invitation Sent│
            │   PENDING      │
            └────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    [Token Used]          [Expired]
         │                     │
         ▼                     ▼
    ┌────────────┐        [No Action]
    │  ACCEPTED  │         [Record
    │ (Account   │          Remains]
    │  Created)  │
    └────────────┘
```

**States:**

- **PENDING:** Invitation created; token valid; user has not accepted (< 24h from creation)
- **ACCEPTED:** User clicked link, created account; invitation "used up"
- **EXPIRED:** Implicit state; if `expires_at < NOW()` and `status='PENDING'`, treat as expired on
  next read

**Transitions:**

- PENDING → ACCEPTED: User accepts and creates account
- PENDING → (implicit EXPIRED): 24h passes without acceptance; user sees "link expired" on click
- ACCEPTED: No further transitions (immutable)

---

## Invitation Security

### One-Time Token Guarantee

- Token generated: 32-byte securely random bytes
- Token hashed: SHA256 (never stored plaintext)
- Token transmission: URL query parameter (HTTPS only)
- Token usage: Can only be used once; acceptance sets `status='ACCEPTED'`
- Token expiration: 24 hours after creation; check `expires_at > NOW()`

### Rate Limiting

- Invitation creation: 20 invitations per hour per user
- Resend: Same rate limit as creation
- Acceptance: No rate limit (one-time token prevents spam)
