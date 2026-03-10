# Structured Logging Guide – Domain Core Services

**For:** Developers implementing business logic in domain-core  
**Version:** 1.0  
**Updated:** 2026-02-25

---

## Overview

All services in `packages/domain-core/src/services/` must use structured logging with the
`packages/logger` utility. No `console.log` allowed in production code.

---

## Logging Patterns

### 1. Service Initialization

```typescript
// services/member.service.ts
import { Logger } from "@zidney/logger";

export class MemberService {
  private logger = new Logger("MemberService");

  constructor() {
    this.logger.info("MemberService initialized");
  }
}
```

### 2. Successful Operation Logging

```typescript
async createMember(email: string, username: string, roleId: UUID): Promise<Member> {
  const correlationId = this.context.correlationId;

  this.logger.info('Creating member', {
    correlation_id: correlationId,
    email,
    username,
    role_id: roleId,
  });

  const member = await this.db.members.create({
    email,
    username,
    role_id: roleId,
  });

  this.logger.info('Member created successfully', {
    correlation_id: correlationId,
    member_id: member.id,
    duration_ms: Date.now() - startTime,
  });

  return member;
}
```

### 3. Error Logging (No Stack Traces to Client)

```typescript
async getMember(memberId: UUID): Promise<Member | null> {
  const correlationId = this.context.correlationId;

  try {
    const member = await this.db.members.findById(memberId);

    if (!member) {
      this.logger.warn('Member not found', {
        correlation_id: correlationId,
        member_id: memberId,
        action: 'get_member',
      });
      return null;
    }

    return member;
  } catch (error) {
    this.logger.error('Failed to retrieve member', {
      correlation_id: correlationId,
      member_id: memberId,
      error_code: error.code,
      error_message: error.message,
      // NO stack trace to client
    });
    throw new AppError('INTERNAL_ERROR', 'Failed to retrieve member');
  }
}
```

### 4. Audit Logging (State Changes)

```typescript
async updateMember(memberId: UUID, updates: Partial<Member>): Promise<Member> {
  const correlationId = this.context.correlationId;
  const actor = this.context.user;

  const before = await this.db.members.findById(memberId);

  const updated = await this.db.members.update(memberId, updates);

  // Log to immutable audit log
  await this.auditService.log({
    correlation_id: correlationId,
    action: 'member_updated',
    actor_user_id: actor.id,
    entity_type: 'member',
    entity_id: memberId,
    before: before,
    after: updated,
    timestamp: new Date(),
  });

  this.logger.info('Member updated', {
    correlation_id: correlationId,
    member_id: memberId,
    actor_id: actor.id,
    fields_changed: Object.keys(updates),
  });

  return updated;
}
```

### 5. Permission Checks

```typescript
async checkPermission(userId: UUID, domain: string, action: string): Promise<boolean> {
  const correlationId = this.context.correlationId;

  const permissions = await this.permissionService.resolvePermissions(userId, domain);
  const allowed = permissions[action] === true;

  this.logger.info('Permission check', {
    correlation_id: correlationId,
    user_id: userId,
    domain,
    action,
    allowed,
  });

  if (!allowed) {
    this.logger.warn('Permission denied', {
      correlation_id: correlationId,
      user_id: userId,
      domain,
      action,
      reason: 'insufficient_permissions',
    });
  }

  return allowed;
}
```

---

## Required Log Fields

Every log entry MUST include:

| Field            | Type    | Example                  | Note                                |
| ---------------- | ------- | ------------------------ | ----------------------------------- |
| `correlation_id` | UUID    | `"abc-123-def"`          | Request-scoped ID for tracing       |
| `service`        | string  | `"MemberService"`        | Service name (automatic via Logger) |
| `action`         | string  | `"member_created"`       | What operation occurred             |
| `timestamp`      | ISO8601 | `"2026-02-25T17:20:00Z"` | Automatic                           |

## Optional Fields (Context-Dependent)

| Field           | Type   | When to Include            | Example                    |
| --------------- | ------ | -------------------------- | -------------------------- |
| `user_id`       | UUID   | User-triggered operations  | `"user-456"`               |
| `member_id`     | UUID   | Member operations          | `"member-789"`             |
| `role_id`       | UUID   | Role operations            | `"role-012"`               |
| `error_code`    | string | Error cases                | `"PERMISSION_DENIED"`      |
| `error_message` | string | Error cases                | `"User lacks permission"`  |
| `duration_ms`   | number | Performance-critical paths | `245`                      |
| `reason`        | string | Denials/warnings           | `"token_version_mismatch"` |

---

## What NOT to Log

❌ **Never log:**

- Plaintext passwords
- API keys or secrets
- JWT tokens (log token_version instead)
- Personal emails (unless required by audit)
- Credit card numbers or PII

✅ **Instead log:**

- Hash of password (if needed for debugging)
- Hashed token identifier
- token_version (integer)
- User ID (UUID, not email)

Example:

```typescript
// ❌ WRONG
this.logger.info("User login", {
  email: "user@example.com",
  password: "SecurePass123!",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
});

// ✅ CORRECT
this.logger.info("User login", {
  user_id: "abc-123",
  token_version: 1,
  correlation_id: "xyz-789",
});
```

---

## Log Levels

| Level     | When to Use                | Example                                         |
| --------- | -------------------------- | ----------------------------------------------- |
| **INFO**  | Normal operations          | `"Member created`, `"Permission check passed"`  |
| **WARN**  | Unexpected but recoverable | `"Member not found"`, `"Retrying operation"`    |
| **ERROR** | Operation failed           | `"Failed to update member"`, `"Database error"` |

---

## Implementation Template

```typescript
import { Logger } from "@zidney/logger";

export class MyService {
  private logger = new Logger("MyService");
  private context: RequestContext; // Injected with correlation_id

  async myOperation(entityId: UUID, data: any): Promise<Result> {
    const correlationId = this.context.correlationId;
    const startTime = Date.now();

    try {
      this.logger.info("Operation started", {
        correlation_id: correlationId,
        operation: "my_operation",
        entity_id: entityId,
      });

      const result = await this.doWork(entityId, data);

      this.logger.info("Operation completed", {
        correlation_id: correlationId,
        entity_id: entityId,
        duration_ms: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this.logger.error("Operation failed", {
        correlation_id: correlationId,
        entity_id: entityId,
        error_code: error.code,
        error_message: error.message,
        duration_ms: Date.now() - startTime,
      });

      throw error;
    }
  }
}
```

---

## Testing Logging

Verify logs in tests:

```typescript
it("should log member creation", async () => {
  const logSpy = jest.spyOn(logger, "info");

  await memberService.createMember("john@example.com", "john_doe", roleId);

  expect(logSpy).toHaveBeenCalledWith(
    "Member created successfully",
    expect.objectContaining({
      correlation_id: expect.any(String),
      member_id: expect.any(String),
    }),
  );
});
```

---

## Questions?

- Logging format: See `packages/logger/src/`
- Correlation ID propagation: Middleware layer handles this
- Audit logging: See `AuditService` implementation
