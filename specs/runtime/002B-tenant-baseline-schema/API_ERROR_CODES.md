/\*\*

- Master Database Error Codes Reference
-
- File: docs/API_ERROR_CODES.md
- Task: T035
- Phase: 6 - Polish and Deployment Readiness
-
- Complete reference for all MasterDBErrorCode values, HTTP status mappings,
- and when each error is thrown
  \*/

# Master Database Error Codes Reference

Last Updated: 2026-02-16

This document describes all error codes that can be returned by the master database API endpoints.

---

## Error Response Format

All error responses follow the standard API envelope:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error description"
  }
}
```

HTTP status codes are determined by the error code.

---

## 400 Bad Request (Client Error)

These errors indicate invalid input from the client. The request format or data is incorrect.

### INVALID_REQUEST_BODY (400)

**Message**: "Request body is invalid JSON or missing required structure"

**When thrown**:

- Request body is not valid JSON
- Request body structure doesn't match expected format
- Missing required fields

**Example**:

```bash
POST /api/products
Content-Type: application/json

{ "invalid": "json" invalid }
```

**Resolution**: Check request body format and structure

---

### INVALID_VERSION_FORMAT (400)

**Message**: "Version must be semantic format (X.Y.Z)"

**When thrown**:

- Version string doesn't match pattern `\d+\.\d+\.\d+`
- Provided version is not a string

**Examples of invalid versions**:

- `1.0` (missing patch)
- `1.0.0.0` (too many components)
- `v1.0.0` (has prefix)

**Valid example**: `1.0.0`, `1.5.3`, `2.0.0`

**Resolution**: Use semantic versioning format

---

### INVALID_WORKSPACE_SLUG_FORMAT (400)

**Message**: "workspace_slug must be lowercase alphanumeric with hyphens only"

**When thrown**:

- Slug contains uppercase letters
- Slug contains special characters (except hyphens)
- Slug is empty or whitespace

**Examples of invalid slugs**:

- `MyWorkspace` (uppercase)
- `my_workspace` (underscore)
- `my workspace` (space)
- ` ` (empty)

**Valid examples**: `my-workspace`, `workspace-1`, `acme-corp-2024`

**Resolution**: Use only lowercase letters, numbers, and hyphens

---

### INVALID_EMAIL_FORMAT (400)

**Message**: "Invalid email format"

**When thrown**:

- Email doesn't contain `@` sign
- Email is empty or whitespace

**Valid examples**: `admin@example.com`, `user+tag@company.org`

**Resolution**: Provide valid email address

---

### INVALID_DATABASE_HOST (400)

**Message**: "db_host is required and must be non-empty"

**When thrown**:

- `db_host` field is missing
- `db_host` is empty or whitespace

**Resolution**: Provide valid database hostname

---

### INVALID_DATABASE_PORT (400)

**Message**: "db_port must be between 1 and 65535"

**When thrown**:

- Port number is outside valid range
- Port is not an integer
- Port is negative or zero

**Valid examples**: `5432`, `3306`, `1433`

**Resolution**: Use port number between 1 and 65535

---

### MISSING_REQUIRED_FIELD (400)

**Message**: "(Field name) is required"

**When thrown**:

- Required field is missing from request
- Required field is null without being nullable

**Examples**:

```json
{
  "error": {
    "code": "MISSING_REQUIRED_FIELD",
    "message": "product_id is required"
  }
}
```

**Resolution**: Include all required fields

---

## 403 Forbidden (Permission Error)

These errors indicate the user lacks permission for the requested operation.

### INSUFFICIENT_PERMISSIONS (403)

**Message**: "User role does not have permission for this operation"

**When thrown**:

- User role (admin/operator/read_only) doesn't allow the operation
- Admin operations attempted by non-admin user

**Examples**:

- Read-only user attempts to CREATE_LICENSE
- Operator attempts to DELETE_PRODUCT

**Resolution**: Use account with appropriate role (admin) or request permission escalation

---

### RBAC_DENIED (403)

**Message**: "Access denied by role-based access control"

**When thrown**:

- Permission explicitly denied by RBAC matrix
- More specific than INSUFFICIENT_PERMISSIONS

**Resolution**: Request admin to grant required permissions

---

### LICENSE_REQUIRED (403)

**Message**: "License required to perform this operation"

**When thrown**:

- Attempting operation without active license
- License has expired or been archived

**Resolution**: Obtain or renew license

---

## 404 Not Found (Resource Not Found)

These errors indicate the requested resource doesn't exist.

### PRODUCT_NOT_FOUND (404)

**Message**: "Product with ID (id) not found"

**When thrown**:

- Looking up product by ID that doesn't exist
- Product has been deleted

**Resolution**: Verify product ID and check if product exists

---

### LICENSE_NOT_FOUND (404)

**Message**: "License with ID (id) not found"

**When thrown**:

- License lookup fails
- License has been deleted

**Resolution**: Verify license ID and check if license exists

---

### TENANT_REGISTRY_NOT_FOUND (404)

**Message**: "Tenant registry entry not found for workspace (slug)"

**When thrown**:

- Tenant database connection not configured
- Workspace has no tenant registry entry

**Resolution**: Create tenant registry for workspace

---

### MMC_USER_NOT_FOUND (404)

**Message**: "MMC user with ID (id) not found"

**When thrown**:

- User lookup fails
- User has been deleted

**Resolution**: Verify user ID and check if user exists

---

### WORKSPACE_NOT_FOUND (404)

**Message**: "Workspace (slug) does not exist or is not accessible"

**When thrown**:

- Workspace slug doesn't match any existing license
- Workspace has been deleted

**Resolution**: Verify workspace slug

---

## 409 Conflict (State Conflict)

These errors indicate a conflict with existing data or state.

### PRODUCT_SLUG_ALREADY_EXISTS (409)

**Message**: "Product slug '(slug)' is already in use"

**When thrown**:

- Attempting to create product with duplicate slug
- Slug must be globally unique

**Resolution**: Use different slug (slugs must be unique)

---

### WORKSPACE_ALREADY_LICENSED (409)

**Message**: "Workspace (slug) already has an active license"

**When thrown**:

- Attempting to create second license for same workspace
- Only one license allowed per workspace

**Resolution**: Use different workspace slug or delete existing license

---

### TENANT_ALREADY_EXISTS (409)

**Message**: "Tenant registry already exists for workspace (slug)"

**When thrown**:

- Attempting to create second tenant registry for same workspace
- One registry per workspace required

**Resolution**: Update existing registry instead of creating new one

---

### EMAIL_ALREADY_EXISTS (409)

**Message**: "Email address already registered"

**When thrown**:

- Attempting to create second user with same email
- Email must be globally unique

**Resolution**: Use different email address

---

### LICENSE_STATE_CONFLICT (409)

**Message**: "Cannot perform operation in license state '(state)'"

**When thrown**:

- Attempting to archive already-archived license
- Attempting to unarchive (no transition back)
- State machine violation

**Examples**:

- Transitioning ARCHIVED → SOFT_LOCKED (invalid, only one-way)
- Operating on archived license

**Resolution**: Check license state before operation

---

## 423 Locked (Resource Locked)

These errors indicate the resource is temporarily or permanently locked.

### LICENSE_SOFT_LOCKED (423)

**Message**: "License is soft-locked (grace period until (date))"

**When thrown**:

- License in SOFT_LOCKED state
- Grace period hasn't expired yet
- Can attempt operation after deadline

**Example response**:

```json
{
  "error": {
    "code": "LICENSE_SOFT_LOCKED",
    "message": "License is soft-locked until 2025-03-15T18:30:00Z"
  }
}
```

**Resolution**: Wait for soft-lock deadline to pass, or contact admin

---

### WORKSPACE_SOFT_LOCKED (423)

**Message**: "Workspace is soft-locked (grace period until (date))"

**When thrown**:

- Workspace's license is in SOFT_LOCKED state
- Student/staff operations blocked during grace period

**Resolution**: Renew license or wait for deadline

---

## 426 Upgrade Required (Version Mismatch)

These errors indicate schema or version incompatibility.

### SCHEMA_VERSION_MISMATCH (426)

**Message**: "Server schema version (version) not compatible with client minimum (version)"

**When thrown**:

- Deployed schema version older than client minimum requirement
- Version compatibility check failed

**Resolution**: Upgrade server to newer schema version

---

### SCHEMA_VERSION_TOO_OLD (426)

**Message**: "Minimum supported schema version is (version), server has (version)"

**When thrown**:

- Server schema version below minimum supported
- Major version incompatibility

**Resolution**: Apply pending migrations to upgrade schema

---

### PRODUCT_VERSION_INCOMPATIBLE (426)

**Message**: "Product (slug) version (version) is not compatible"

**When thrown**:

- Product version doesn't match expected version
- API version mismatch with product definition

**Resolution**: Update product or client to compatible version

---

## 500 Internal Server Error

These errors indicate server-side failures.

### DATABASE_ERROR (500)

**Message**: "Database operation failed: (error details)"

**When thrown**:

- uncaught database connection error
- Query execution error
- Transaction failure (not constraint-based)

**Examples**:

- Connection pool exhausted
- Database unreachable
- Out of disk space

**Resolution**: Check server logs and database status

---

### MIGRATION_FAILURE (500)

**Message**: "Database migration failed: (error details)"

**When thrown**:

- Migration execution failed
- Schema update error
- Rollback error

**Resolution**: Check migration logs and verify database state

---

### INTERNAL_ERROR (500)

**Message**: "An unexpected error occurred"

**When thrown**:

- Unhandled exception
- Catch-all for unexpected errors

**Resolution**: Check server logs for details

---

## Error Code → HTTP Status Mapping

Quick reference table for all error codes:

| Error Code                    | HTTP Status |
| ----------------------------- | ----------- |
| INVALID_REQUEST_BODY          | 400         |
| INVALID_VERSION_FORMAT        | 400         |
| INVALID_WORKSPACE_SLUG_FORMAT | 400         |
| INVALID_EMAIL_FORMAT          | 400         |
| INVALID_DATABASE_HOST         | 400         |
| INVALID_DATABASE_PORT         | 400         |
| MISSING_REQUIRED_FIELD        | 400         |
| INSUFFICIENT_PERMISSIONS      | 403         |
| RBAC_DENIED                   | 403         |
| LICENSE_REQUIRED              | 403         |
| PRODUCT_NOT_FOUND             | 404         |
| LICENSE_NOT_FOUND             | 404         |
| TENANT_REGISTRY_NOT_FOUND     | 404         |
| MMC_USER_NOT_FOUND            | 404         |
| WORKSPACE_NOT_FOUND           | 404         |
| PRODUCT_SLUG_ALREADY_EXISTS   | 409         |
| WORKSPACE_ALREADY_LICENSED    | 409         |
| TENANT_ALREADY_EXISTS         | 409         |
| EMAIL_ALREADY_EXISTS          | 409         |
| LICENSE_STATE_CONFLICT        | 409         |
| LICENSE_SOFT_LOCKED           | 423         |
| WORKSPACE_SOFT_LOCKED         | 423         |
| SCHEMA_VERSION_MISMATCH       | 426         |
| SCHEMA_VERSION_TOO_OLD        | 426         |
| PRODUCT_VERSION_INCOMPATIBLE  | 426         |
| DATABASE_ERROR                | 500         |
| MIGRATION_FAILURE             | 500         |
| INTERNAL_ERROR                | 500         |

---

## Related Documentation

- [API Response Envelope Format](../03_ENGINEERING_WORKFLOW/API_RESPONSE_FORMAT.md)
- [Error Handling Standards](../01_ENGINEERING_GOVERNANCE/09_ERROR_HANDLING_STANDARD.md)
- [Master Database Schema](../../apps/api/src/db/master/README.md)
