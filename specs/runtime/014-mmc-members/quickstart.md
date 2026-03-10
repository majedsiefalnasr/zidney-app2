# Quickstart Guide — STAGE_14_MMC_MEMBERS

## Overview

This guide provides practical code examples for developers implementing and using the MMC Members &
RBAC system.

---

## Part 1: Setup & Prerequisites

### Database Migrations

```bash
# Run all MMC migrations (from repo root)
npm run migrate:master

# Verify tables created
psql master_db -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name LIKE 'mmc_%'
"
# Expected output:
# mmc_members
# mmc_member_invitations
# mmc_audit_log
# role_permissions
# roles
# request_log
```

### Environment Configuration

```bash
# .env (development only)
MASTER_DB_HOST=localhost
MASTER_DB_PORT=5432
MASTER_DB_NAME=master
MASTER_DB_USER=app_admin
MASTER_DB_PASSWORD=secure_password

JWT_SECRET=your_long_random_secret_minimum_32_characters
JWT_ISSUER=mmc
JWT_EXPIRATION_SECONDS=3600

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

LOG_LEVEL=debug

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=email_password
```

### Seed Initial Roles (Optional)

```sql
-- Insert default roles into master_db
INSERT INTO roles (id, name, description, status, created_at, updated_at) VALUES
('role-admin-uuid', 'Platform Administrator', 'Full platform access', 'ACTIVE', NOW(), NOW()),
('role-sales-uuid', 'Sales Team', 'Product and client management', 'ACTIVE', NOW(), NOW()),
('role-support-uuid', 'Support Team', 'View-only access to client data', 'ACTIVE', NOW(), NOW());

-- Insert permissions for Platform Administrator (all permissions = true)
INSERT INTO role_permissions (role_id, domain, can_view, can_create, can_edit, can_delete, created_at, updated_at) VALUES
('role-admin-uuid', 'ORGANIZATION_SETTINGS', true, true, true, true, NOW(), NOW()),
('role-admin-uuid', 'PRODUCT_MANAGEMENT', true, true, true, true, NOW(), NOW()),
('role-admin-uuid', 'LICENSE_MANAGEMENT', true, true, true, true, NOW(), NOW()),
('role-admin-uuid', 'CLIENT_MANAGEMENT', true, true, true, true, NOW(), NOW()),
('role-admin-uuid', 'AFFILIATE_MANAGEMENT', true, true, true, true, NOW(), NOW()),
('role-admin-uuid', 'MEMBERS_MANAGEMENT', true, true, true, true, NOW(), NOW()),
('role-admin-uuid', 'REPORTING', true, true, true, true, NOW(), NOW());

-- Insert permissions for Sales Team (limited access)
INSERT INTO role_permissions (role_id, domain, can_view, can_create, can_edit, can_delete, created_at, updated_at) VALUES
('role-sales-uuid', 'PRODUCT_MANAGEMENT', true, true, true, false, NOW(), NOW()),
('role-sales-uuid', 'CLIENT_MANAGEMENT', true, true, true, false, NOW(), NOW()),
('role-sales-uuid', 'ORGANIZATION_SETTINGS', true, false, false, false, NOW(), NOW());

-- Insert seed admin member
INSERT INTO mmc_members (id, username, email, password_hash, role_id, status, created_at, updated_at) VALUES
('admin-member-uuid', 'admin', 'admin@zidney.example.com',
 '$2b$12$...bcrypt_hash_of_password...', 'role-admin-uuid', 'ACTIVE', NOW(), NOW());
```

---

## Part 2: Authentication Flow

### Example 1: Login & Get JWT Token

```typescript
// Frontend | TypeScript + Vue 3
import { ref } from "vue";
import axios from "axios";

const username = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

async function handleLogin() {
  loading.value = true;
  error.value = "";

  try {
    const response = await axios.post("/mmc/auth/login", {
      username: username.value,
      password: password.value,
    });

    if (response.data.success) {
      // Store token in localStorage or secure cookie
      localStorage.setItem("mmc_token", response.data.data.access_token);
      localStorage.setItem("mmc_user", JSON.stringify(response.data.data.user));

      // Redirect to dashboard
      window.location.href = "/mmc/dashboard";
    } else {
      error.value = response.data.error.message;
    }
  } catch (err) {
    if (err.response?.status === 429) {
      error.value = "Too many login attempts. Try again in 1 hour.";
    } else {
      error.value = "Invalid username or password";
    }
  } finally {
    loading.value = false;
  }
}
```

### Example 2: Use Token in Subsequent Requests

```typescript
// Frontend | TypeScript
import axios from "axios";

// Create axios instance with default headers
const mmc = axios.create({
  baseURL: "/mmc",
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor: Add token to all requests
mmc.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("mmc_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor: Handle 401 (expired/invalidated token)
mmc.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session invalidated or token expired
      localStorage.removeItem("mmc_token");
      localStorage.removeItem("mmc_user");
      window.location.href = "/mmc/login";
    }
    return Promise.reject(error);
  },
);

export default mmc;
```

### Example 3: Backend Token Verification (Hono Middleware)

```typescript
// Backend | Hono + TypeScript
import { Hono, Context } from "hono";
import jwt from "@hono/jwt";
import { getLogger } from "@packages/logger";

const app = new Hono();
const log = getLogger("mmc-api");

// Correlation ID middleware
app.use("*", (c, next) => {
  const correlationId = c.req.header("X-Correlation-ID") || crypto.randomUUID();
  c.set("correlationId", correlationId);
  c.set("logger", log.with({ correlation_id: correlationId }));
  return next();
});

// JWT verification middleware
app.use(
  "/mmc/*",
  jwt({
    secret: process.env.JWT_SECRET,
    alg: "HS256",
    noVerify: false,
  }),
);

// Extended auth middleware: Check token_version + status
app.use("/mmc/*", async (c, next) => {
  const payload = c.get("jwtPayload");
  const logger = c.get("logger");

  // Reject cross-context tokens
  if (payload.workspace_id) {
    logger.warn("cross_context_token_rejected");
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Fetch member from DB
  const db = getMasterPool();
  const member = await db.queryOne(
    "SELECT id, status, role_id, token_version FROM mmc_members WHERE id = ?",
    [payload.sub],
  );

  if (!member) {
    logger.warn("member_not_found", { user_id: payload.sub });
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (member.status !== "ACTIVE") {
    logger.warn("member_disabled", { user_id: payload.sub });
    return c.json({ error: "Account disabled" }, 401);
  }

  // Check token_version (session invalidation)
  if (payload.token_version !== member.token_version) {
    logger.info("session_invalidated", {
      user_id: payload.sub,
      jwt_version: payload.token_version,
      db_version: member.token_version,
    });
    return c.json({ error: "Session invalidated; please re-login" }, 401);
  }

  // Store context
  c.set("mmc_user", {
    user_id: member.id,
    role_id: member.role_id,
    token_version: member.token_version,
  });

  logger.debug("auth_success", { user_id: payload.sub });
  return next();
});

export default app;
```

---

## Part 3: Permission Checking

### Example 4: Permission Enforcement Middleware

```typescript
// Backend | Hono middleware
import { Context } from "hono";

interface PermissionRequirement {
  domain: string;
  action: "view" | "create" | "edit" | "delete";
}

// Route metadata: map routes to permissions
const routePermissions: Map<string, PermissionRequirement> = new Map([
  ["GET /mmc/members/:id", { domain: "MEMBERS_MANAGEMENT", action: "view" }],
  ["POST /mmc/members", { domain: "MEMBERS_MANAGEMENT", action: "create" }],
  ["PATCH /mmc/members/:id", { domain: "MEMBERS_MANAGEMENT", action: "edit" }],
  ["DELETE /mmc/members/:id", { domain: "MEMBERS_MANAGEMENT", action: "delete" }],
  ["GET /mmc/roles", { domain: "MEMBERS_MANAGEMENT", action: "view" }],
  ["PATCH /mmc/roles/:id/permissions", { domain: "MEMBERS_MANAGEMENT", action: "edit" }],
]);

async function permissionMiddleware(c: Context, next: Function) {
  const routeKey = `${c.req.method} ${c.req.path}`;
  const permission = routePermissions.get(routeKey);

  if (!permission) {
    // No permission required (public or optional)
    return next();
  }

  const mmc_user = c.get("mmc_user");
  const logger = c.get("logger");
  const db = getMasterPool();

  // Query permission matrix
  const perm = await db.queryOne(
    "SELECT can_view, can_create, can_edit, can_delete FROM role_permissions WHERE role_id = ? AND domain = ?",
    [mmc_user.role_id, permission.domain],
  );

  // Check permission bit
  const actionMap = {
    view: perm?.can_view,
    create: perm?.can_create,
    edit: perm?.can_edit,
    delete: perm?.can_delete,
  };

  const hasPermission = actionMap[permission.action] ?? false;

  if (!hasPermission) {
    logger.warn("permission_denied", {
      user_id: mmc_user.user_id,
      domain: permission.domain,
      action: permission.action,
    });

    // Log audit entry
    await db.execute(
      "INSERT INTO mmc_audit_log (actor_user_id, action_type, entity_type, correlation_id, timestamp) VALUES (?, ?, ?, ?, NOW())",
      [mmc_user.user_id, "PERMISSION_CHECK_DENIED", permission.domain, c.get("correlationId")],
    );

    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: "PERMISSION_DENIED",
          message: `Permission denied: ${permission.domain}.${permission.action}`,
        },
      },
      403,
    );
  }

  return next();
}

export { permissionMiddleware, routePermissions };
```

---

## Part 4: Member Creation

### Example 5: Create Member (Direct Add)

```typescript
// Backend | Create member in service layer
import bcrypt from "bcrypt";
import { MemberService } from "@packages/domain-core";

class MemberService {
  constructor(private db: Pool) {}

  async createMember(
    data: {
      username: string;
      email: string;
      password: string;
      role_id: string;
    },
    actor_user_id: string,
    correlation_id: string,
  ) {
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Transaction
    return this.db.transaction(async (tx) => {
      // Validate
      const existingUsername = await tx.queryOne("SELECT id FROM mmc_members WHERE username = ?", [
        data.username,
      ]);
      if (existingUsername) {
        throw new Error("DUPLICATE_USERNAME");
      }

      const existingEmail = await tx.queryOne("SELECT id FROM mmc_members WHERE email = ?", [
        data.email,
      ]);
      if (existingEmail) {
        throw new Error("DUPLICATE_EMAIL");
      }

      const role = await tx.queryOne("SELECT id FROM roles WHERE id = ? AND status = ?", [
        data.role_id,
        "ACTIVE",
      ]);
      if (!role) {
        throw new Error("INVALID_ROLE");
      }

      // Create member
      const member = await tx.queryOne(
        `INSERT INTO mmc_members 
         (username, email, password_hash, role_id, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, NOW(), NOW())
         RETURNING *`,
        [data.username, data.email, hashedPassword, data.role_id, actor_user_id],
      );

      // Audit log
      await tx.execute(
        `INSERT INTO mmc_audit_log 
         (actor_user_id, action_type, entity_type, entity_id, new_state, correlation_id, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          actor_user_id,
          "MEMBER_CREATED",
          "MEMBER",
          member.id,
          JSON.stringify({ username: member.username, email: member.email }),
          correlation_id,
        ],
      );

      return member;
    });
  }
}

// Hono route
app.post("/mmc/members", permissionMiddleware, async (c) => {
  const data = await c.req.json();
  const mmc_user = c.get("mmc_user");
  const logger = c.get("logger");

  try {
    const memberService = new MemberService(getMasterPool());
    const member = await memberService.createMember(data, mmc_user.user_id, c.get("correlationId"));

    logger.info("member_created", { member_id: member.id });

    return c.json(
      {
        success: true,
        data: member,
        error: null,
      },
      201,
    );
  } catch (err) {
    if (err.message === "DUPLICATE_USERNAME") {
      return c.json(
        {
          success: false,
          data: null,
          error: { code: "CONFLICT", message: "Username already exists" },
        },
        409,
      );
    }
    throw err;
  }
});
```

---

## Part 5: Role Permission Update (Cascading)

### Example 6: Update Role Permissions with Token Invalidation

```typescript
// Backend | Service layer
class RoleService {
  constructor(private db: Pool) {}

  async updateRolePermissions(
    role_id: string,
    permissions: Array<{
      domain: string;
      can_view: boolean;
      can_create: boolean;
      can_edit: boolean;
      can_delete: boolean;
    }>,
    actor_user_id: string,
    correlation_id: string,
  ) {
    return this.db.transaction(async (tx) => {
      // Verify role exists
      const role = await tx.queryOne("SELECT id FROM roles WHERE id = ?", [role_id]);
      if (!role) throw new Error("ROLE_NOT_FOUND");

      // Update permissions
      for (const perm of permissions) {
        await tx.execute(
          `UPDATE role_permissions 
           SET can_view = ?, can_create = ?, can_edit = ?, can_delete = ?, updated_at = NOW()
           WHERE role_id = ? AND domain = ?`,
          [perm.can_view, perm.can_create, perm.can_edit, perm.can_delete, role_id, perm.domain],
        );
      }

      // CASCADE: Increment token_version for all members with this role
      const members = await tx.query("SELECT id FROM mmc_members WHERE role_id = ?", [role_id]);

      for (const member of members) {
        await tx.execute(
          "UPDATE mmc_members SET token_version = token_version + 1, updated_at = NOW() WHERE id = ?",
          [member.id],
        );

        // Audit log (one per member)
        await tx.execute(
          `INSERT INTO mmc_audit_log 
           (actor_user_id, action_type, entity_type, entity_id, 
            previous_state, new_state, correlation_id, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            actor_user_id,
            "PERMISSION_BATCH_UPDATED",
            "MEMBER",
            member.id,
            JSON.stringify({ role_id }),
            JSON.stringify({ role_id, permissions_updated: true }),
            correlation_id,
          ],
        );
      }

      return { affected_members: members.length };
    });
  }
}

// Hono route
app.patch("/mmc/roles/:id/permissions", permissionMiddleware, async (c) => {
  const role_id = c.req.param("id");
  const { permissions } = await c.req.json();
  const mmc_user = c.get("mmc_user");

  const roleService = new RoleService(getMasterPool());
  const result = await roleService.updateRolePermissions(
    role_id,
    permissions,
    mmc_user.user_id,
    c.get("correlationId"),
  );

  return c.json(
    {
      success: true,
      data: {
        role_id,
        affected_members: result.affected_members,
        token_versions_incremented: true,
        message: `Permissions updated; ${result.affected_members} active sessions will be invalidated`,
      },
      error: null,
    },
    200,
  );
});
```

---

## Part 6: Checking Permissions (Frontend Optimization)

### Example 7: Query & Cache Permissions

```typescript
// Frontend | Vue 3 Composable
import { ref, computed } from "vue";
import mmc from "@/api/mmc";

export function usePermissions() {
  const permissions = ref<
    Record<
      string,
      {
        can_view: boolean;
        can_create: boolean;
        can_edit: boolean;
        can_delete: boolean;
      }
    >
  >({});
  const loading = ref(false);

  async function fetchPermissions(domains: string[]) {
    loading.value = true;
    try {
      const response = await mmc.get("/permissions/check", {
        params: { domains: domains.join(",") },
      });
      permissions.value = response.data.data.permissions;
      sessionStorage.setItem("mmc_permissions", JSON.stringify(permissions.value));
    } finally {
      loading.value = false;
    }
  }

  // Helpers
  const canViewMembers = computed(() => permissions.value.MEMBERS_MANAGEMENT?.can_view ?? false);
  const canCreateMembers = computed(
    () => permissions.value.MEMBERS_MANAGEMENT?.can_create ?? false,
  );
  const canEditMembers = computed(() => permissions.value.MEMBERS_MANAGEMENT?.can_edit ?? false);
  const canDeleteMembers = computed(
    () => permissions.value.MEMBERS_MANAGEMENT?.can_delete ?? false,
  );

  return {
    permissions,
    loading,
    fetchPermissions,
    canViewMembers,
    canCreateMembers,
    canEditMembers,
    canDeleteMembers,
  };
}

// Component usage
import { usePermissions } from "@/composables/usePermissions";

export default {
  setup() {
    const { permissions, canCreateMembers, fetchPermissions } = usePermissions();

    // On mount: fetch permissions once
    onMounted(() => {
      fetchPermissions(["MEMBERS_MANAGEMENT", "PRODUCT_MANAGEMENT"]);
    });

    return {
      permissions,
      canCreateMembers,
    };
  },
  template: `
    <div>
      <!-- Show "Create Member" button only if user has permission -->
      <button v-if="canCreateMembers" @click="openCreateDialog">
        Create Member
      </button>
      <!-- Otherwise, show grayed-out button with tooltip -->
      <button v-else disabled title="You lack permission to create members">
        Create Member
      </button>
    </div>
  `,
};
```

---

## Part 7: Member Disablement (Session Invalidation)

### Example 8: Disable Member + Cascade Token Version

```typescript
// Backend | Service layer
class MemberService {
  async disableMember(member_id: string, actor_user_id: string, correlation_id: string) {
    return this.db.transaction(async (tx) => {
      // Fetch current state
      const member = await tx.queryOne(
        "SELECT id, status, token_version FROM mmc_members WHERE id = ?",
        [member_id],
      );

      if (!member) throw new Error("NOT_FOUND");
      if (member.status === "DISABLED") throw new Error("ALREADY_DISABLED");

      // Disable + increment token_version
      const updated = await tx.queryOne(
        `UPDATE mmc_members 
         SET status = 'DISABLED', token_version = token_version + 1, updated_at = NOW()
         WHERE id = ?
         RETURNING *`,
        [member_id],
      );

      // Audit log
      await tx.execute(
        `INSERT INTO mmc_audit_log 
         (actor_user_id, action_type, entity_type, entity_id, 
          previous_state, new_state, correlation_id, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          actor_user_id,
          "MEMBER_DISABLED",
          "MEMBER",
          member_id,
          JSON.stringify({
            status: member.status,
            token_version: member.token_version,
          }),
          JSON.stringify({
            status: "DISABLED",
            token_version: updated.token_version,
          }),
          correlation_id,
        ],
      );

      return updated;
    });
  }
}
```

---

## Part 8: Debugging Checklist

### Troubleshooting Auth Issues

```typescript
// Debugging: Check member record
SELECT id, username, email, status, role_id, token_version FROM mmc_members WHERE username = 'john.doe';

// Debugging: Check role permissions
SELECT domain, can_view, can_create, can_edit, can_delete FROM role_permissions WHERE role_id = 'role-uuid';

// Debugging: Check audit log for recent actions
SELECT action_type, actor_user_id, entity_type, entity_id, timestamp FROM mmc_audit_log
ORDER BY timestamp DESC LIMIT 20;

// Debugging: Check if login is rate-limited
redis-cli GET "mmc:login_attempts:203.0.113.45"

// Common issues:

// Issue 1: 401 Unauthorized on valid credentials
// → Check member.status = 'ACTIVE'
// → Check role.status = 'ACTIVE'
// → Verify password hash with bcrypt.compare()

// Issue 2: 403 Permission Denied unexpectedly
// → Verify permission row exists: role_permissions (role_id, domain, can_X bits)
// → Check domain name exactly (enum values case-sensitive: MEMBERS_MANAGEMENT not Members_Management)
// → Verify role_id matches member.role_id

// Issue 3: Permission change doesn't take effect immediately
// → Verify token_version was incremented for all affected members
// → Client must re-login (old token still cached in browser)
// → Check if Redis idempotency cache is stale (flush if needed)

// Issue 4: Session not invalidated after disable
// → Verify member.status = 'DISABLED'
// → Verify middleware checks token_version mismatch
// → Client-side: check for 401 response and clear cached token
```

---

## Part 9: API Response Examples

### Success Response Format

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "john.doe",
    "email": "john@example.com",
    "created_at": "2026-02-25T10:30:00.000Z"
  },
  "error": null
}
```

### Error Response Format

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You lack permission for MEMBERS_MANAGEMENT.create"
  }
}
```

---

## Part 10: Testing Examples

### Unit Test: Permission Check

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { checkPermission } from "@packages/domain-core";

describe("checkPermission", () => {
  it("should allow action if permission bit is true", async () => {
    const result = await checkPermission("role-admin-uuid", "MEMBERS_MANAGEMENT", "create", db);
    expect(result).toBe(true);
  });

  it("should deny action if permission bit is false", async () => {
    const result = await checkPermission("role-sales-uuid", "MEMBERS_MANAGEMENT", "delete", db);
    expect(result).toBe(false);
  });

  it("should deny action if permission row missing", async () => {
    const result = await checkPermission("role-unknown-uuid", "MEMBERS_MANAGEMENT", "view", db);
    expect(result).toBe(false);
  });
});
```

### Integration Test: Member Creation

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import axios from "axios";

describe("POST /mmc/members", () => {
  let token: string;

  beforeEach(async () => {
    // Login as admin
    const response = await axios.post("http://localhost:3000/mmc/auth/login", {
      username: "admin",
      password: "admin_password",
    });
    token = response.data.data.access_token;
  });

  it("should create member with valid credentials", async () => {
    const response = await axios.post(
      "http://localhost:3000/mmc/members",
      {
        username: "newuser",
        email: "newuser@example.com",
        password: "Password123!",
        role_id: "role-admin-uuid",
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
    expect(response.data.data.username).toBe("newuser");
  });

  it("should reject duplicate username", async () => {
    await axios.post(
      "http://localhost:3000/mmc/members",
      {
        username: "duplicate",
        email: "first@example.com",
        password: "Password123!",
        role_id: "role-admin-uuid",
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const response = await axios.post(
      "http://localhost:3000/mmc/members",
      {
        username: "duplicate",
        email: "second@example.com",
        password: "Password123!",
        role_id: "role-admin-uuid",
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    expect(response.status).toBe(409);
    expect(response.data.error.code).toBe("CONFLICT");
  });
});
```

---

## References

- [data-model.md](./data-model.md) — Complete schema specification
- [plan.md](./plan.md) — Technical design details
- [contracts/](./contracts/) — API contract files
- [research.md](./research.md) — Architecture decisions
