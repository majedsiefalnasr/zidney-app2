/\*\*

- T058: API Documentation (OpenAPI/Swagger)
- File: apps/api/docs/mmc-api.openapi.yaml or inline JSDoc comments \*/

/\*\*

- OpenAPI Specification for MMC API
-
- Base: /mmc
- Security: Bearer JWT (issuer=mmc, no workspace_id)
-
- All endpoints require authentication except:
- - POST /auth/login
- - POST /invitations/:token/accept \*/

/\*\*

- POST /mmc/auth/login
-
- Public endpoint: Create MMC session
-
- Request:
- {
- "username": "string (required)",
- "password": "string (required, min 8 chars, uppercase+lowercase+digit+special)"
- }
-
- Response 200:
- {
- "access_token": "JWT string",
- "user_id": "UUID",
- "username": "string",
- "role_id": "UUID",
- "token_version": "integer",
- "token_type": "Bearer",
- "expires_in": 3600
- }
-
- Response 401:
- {
- "success": false,
- "error": {
-     "code": "invalid_credentials" | "account_disabled",
-     "message": "..."
- }
- }
-
- Response 429:
- {
- "success": false,
- "error": {
-     "code": "rate_limit_exceeded",
-     "message": "Too many login attempts"
- }
- }
-
- Rate Limit: 5 per minute per IP \*/

/\*\*

- POST /mmc/auth/logout
-
- Authenticated endpoint: End MMC session
-
- Headers: Authorization: Bearer {token}
-
- Response 200:
- {
- "success": true,
- "message": "Logged out successfully"
- }
-
- Response 401: Invalid or expired token \*/

/\*\*

- GET /mmc/permissions/check
-
- Authenticated endpoint: Get current user's permissions
-
- Query Parameters:
- - domains: comma-separated list (optional)
- Example: ?domains=ORGANIZATION_SETTINGS,PRODUCT_MANAGEMENT
- If omitted: all 7 domains returned
-
- Response 200:
- {
- "success": true,
- "data": [
-     {
-       "domain": "ORGANIZATION_SETTINGS",
-       "can_view": true,
-       "can_create": false,
-       "can_edit": true,
-       "can_delete": false
-     },
-     ...
- ]
- }
-
- Response 401: Unauthenticated or token_version mismatch
-
- Rate Limit: 60 per minute \*/

/\*\*

- POST /mmc/members
-
- Authenticated endpoint: Create new MMC member
- Permission: MEMBERS_MANAGEMENT.create (required)
-
- Request:
- {
- "username": "string (required, 3-32 chars, alphanumeric + underscore, unique)",
- "email": "string (required, valid email, unique)",
- "password": "string (required, 8+ chars, uppercase+lowercase+digit+special)",
- "role_id": "UUID (required, must reference ACTIVE role)"
- }
-
- Response 201:
- {
- "success": true,
- "data": {
-     "id": "UUID",
-     "username": "string",
-     "email": "string",
-     "role_id": "UUID",
-     "role_name": "string (looked up)",
-     "status": "ACTIVE",
-     "token_version": 1,
-     "created_at": "ISO 8601",
-     "team_id": "UUID or null",
-     "group_id": "UUID or null",
-     "department_id": "UUID or null"
- }
- }
-
- Response 400: Invalid input (password complexity, email format, etc.)
- Response 401: Unauthenticated
- Response 403: Insufficient permission (missing MEMBERS_MANAGEMENT.create)
- Response 409: Conflict (duplicate username or email)
-
- Rate Limit: 10 per minute \*/

/\*\*

- GET /mmc/members/:id
-
- Authenticated endpoint: Get member details
- Permission: MEMBERS_MANAGEMENT.view (required)
-
- Path Parameters:
- - id: UUID of member
-
- Response 200:
- {
- "success": true,
- "data": {
-     "id": "UUID",
-     "username": "string",
-     "email": "string",
-     "role_id": "UUID",
-     "role_name": "string",
-     "status": "ACTIVE" | "DISABLED",
-     "token_version": integer,
-     "created_at": "ISO 8601",
-     "updated_at": "ISO 8601",
-     "created_by": "UUID",
-     "created_by_username": "string",
-     "team_id": "UUID or null",
-     "group_id": "UUID or null",
-     "department_id": "UUID or null"
- }
- }
-
- Response 401: Unauthenticated
- Response 403: Insufficient permission
- Response 404: Member not found
-
- Rate Limit: 60 per minute \*/

/\*\*

- PATCH /mmc/members/:id
-
- Authenticated endpoint: Update member fields
- Permission: MEMBERS_MANAGEMENT.edit (required)
-
- Request (all optional):
- {
- "email": "string (optional, must be unique)",
- "team_id": "UUID or null (optional)",
- "group_id": "UUID or null (optional)",
- "department_id": "UUID or null (optional)"
- }
-
- Immutable fields (cannot be updated):
- - username, password_hash, role_id, status, token_version
-
- Response 200: Updated member object (same as GET)
-
- Response 400: Invalid email format
- Response 401: Unauthenticated
- Response 403: Insufficient permission
- Response 404: Member not found
- Response 409: Duplicate email
-
- Rate Limit: 20 per minute \*/

/\*\*

- DELETE /mmc/members/:id
-
- Authenticated endpoint: Disable member (soft delete)
- Permission: MEMBERS_MANAGEMENT.delete (required)
-
- Note: Sets status='DISABLED' and increments token_version
- This invalidates all active sessions for this member
-
- Response 200:
- {
- "success": true,
- "data": {
-     "id": "UUID",
-     "status": "DISABLED",
-     "token_version": integer (incremented)
- }
- }
-
- Response 401: Unauthenticated
- Response 403: Insufficient permission
- Response 404: Member not found
-
- Rate Limit: 5 per minute \*/

/\*\*

- GET /mmc/roles
-
- Authenticated endpoint: List roles
- Permission: MEMBERS_MANAGEMENT.view (required)
-
- Query Parameters:
- - status: "ACTIVE" | "INACTIVE" (optional, default: ACTIVE)
-
- Response 200:
- {
- "success": true,
- "data": [
-     {
-       "id": "UUID",
-       "name": "string",
-       "status": "ACTIVE" | "INACTIVE",
-       "member_count": integer,
-       "created_at": "ISO 8601"
-     },
-     ...
- ]
- }
-
- Response 401: Unauthenticated
- Response 403: Insufficient permission
-
- Rate Limit: 60 per minute \*/

/\*\*

- GET /mmc/roles/:id
-
- Authenticated endpoint: Get role details
- Permission: MEMBERS_MANAGEMENT.view (required)
-
- Response 200:
- {
- "success": true,
- "data": {
-     "id": "UUID",
-     "name": "string",
-     "status": "ACTIVE" | "INACTIVE",
-     "member_count": integer,
-     "created_at": "ISO 8601",
-     "updated_at": "ISO 8601"
- }
- }
-
- Response 401: Unauthenticated
- Response 403: Insufficient permission
- Response 404: Role not found
-
- Rate Limit: 60 per minute \*/

/\*\*

- GET /mmc/roles/:id/permissions
-
- Authenticated endpoint: Get role permission matrix
- Permission: MEMBERS_MANAGEMENT.view (required)
-
- Response 200:
- {
- "success": true,
- "data": [
-     {
-       "domain": "ORGANIZATION_SETTINGS",
-       "can_view": true,
-       "can_create": false,
-       "can_edit": true,
-       "can_delete": false
-     },
-     {
-       "domain": "PRODUCT_MANAGEMENT",
-       "can_view": true,
-       "can_create": true,
-       "can_edit": true,
-       "can_delete": true
-     },
-     ... (7 domains total)
- ]
- }
-
- Domains:
- - ORGANIZATION_SETTINGS
- - PRODUCT_MANAGEMENT
- - LICENSE_MANAGEMENT
- - CLIENT_MANAGEMENT
- - AFFILIATE_MANAGEMENT
- - MEMBERS_MANAGEMENT
- - REPORTING
-
- Response 401: Unauthenticated
- Response 403: Insufficient permission
- Response 404: Role not found
-
- Rate Limit: 60 per minute \*/

/\*\*

- PATCH /mmc/roles/:id/permissions
-
- Authenticated endpoint: Update role permissions
- Permission: MEMBERS_MANAGEMENT.edit (required)
-
- Important: Updates cascade token_version to all members with this role
- This invalidates all their active sessions
-
- Request:
- {
- "permissions": [
-     {
-       "domain": "PRODUCT_MANAGEMENT",
-       "can_view": true,
-       "can_create": true,
-       "can_edit": false,
-       "can_delete": false
-     },
-     ...
- ]
- }
-
- Response 200:
- {
- "success": true,
- "data": {
-     "permissions": [...],
-     "affected_members_count": integer
- }
- }
-
- Response 400: Invalid domain
- Response 401: Unauthenticated
- Response 403: Insufficient permission
- Response 404: Role not found
-
- Rate Limit: 10 per minute \*/

/\*\*

- POST /mmc/invitations
-
- Authenticated endpoint: Send member invitation
- Permission: MEMBERS_MANAGEMENT.create (required)
-
- Request:
- {
- "email": "string (required, valid email)",
- "role_id": "UUID (required)"
- }
-
- Response 201:
- {
- "success": true,
- "data": {
-     "invitation_id": "UUID",
-     "email": "string",
-     "role_id": "UUID",
-     "status": "PENDING",
-     "expires_at": "ISO 8601 (24 hours from now)"
- }
- }
-
- Email sent asynchronously with accept link
-
- Response 400: Invalid email or role_id
- Response 401: Unauthenticated
- Response 403: Insufficient permission (missing MEMBERS_MANAGEMENT.create)
- Response 409: Email already member or pending invitation exists
-
- Rate Limit: 20 per hour \*/

/\*\*

- GET /mmc/invitations
-
- Authenticated endpoint: List invitations
- Permission: MEMBERS_MANAGEMENT.view (required)
-
- Query Parameters:
- - status: "PENDING" | "ACCEPTED" | "EXPIRED" (optional)
- - limit: integer (default: 10, max: 100)
- - offset: integer (default: 0)
-
- Response 200:
- {
- "success": true,
- "data": {
-     "invitations": [
-       {
-         "invitation_id": "UUID",
-         "email": "string",
-         "role_id": "UUID",
-         "role_name": "string",
-         "status": "PENDING" | "ACCEPTED" | "EXPIRED",
-         "expires_at": "ISO 8601",
-         "invited_at": "ISO 8601"
-       },
-       ...
-     ],
-     "total_count": integer,
-     "limit": integer,
-     "offset": integer
- }
- }
-
- Note: Plaintext token NOT returned (only in email)
-
- Response 401: Unauthenticated
- Response 403: Insufficient permission
-
- Rate Limit: 60 per minute \*/

/\*\*

- POST /mmc/invitations/:token/accept
-
- Public endpoint: Accept invitation and create account
-
- Path Parameters:
- - token: 32-byte token from invitation email (plaintext)
-
- Request:
- {
- "password": "string (required, 8+ chars, uppercase+lowercase+digit+special)"
- }
-
- Response 201:
- {
- "success": true,
- "data": {
-     "user_id": "UUID",
-     "username": "string (auto-generated from email)",
-     "email": "string",
-     "role_id": "UUID",
-     "role_name": "string"
- }
- }
-
- Response 400: Invalid password complexity
- Response 401: Invalid token, token expired, or already accepted
-
- Rate Limit: 5 per day (per IP) \*/

/\*\*

- GET /health
-
- Public endpoint: Health check
-
- Response 200:
- {
- "status": "healthy",
- "master_db": "connected",
- "redis": "connected",
- "migrations_current": true
- }
-
- Response 503:
- {
- "status": "unhealthy",
- "master_db": "disconnected",
- "redis": "disconnected",
- "migrations_current": false
- } \*/

/\*\*

- HTTP Status Codes Used:
- - 200 OK: Successful GET/PATCH
- - 201 Created: Successful POST
- - 204 No Content: Successful DELETE (optional alternative to 200)
- - 400 Bad Request: Invalid input, validation error
- - 401 Unauthorized: Missing/invalid auth, token_version mismatch
- - 403 Forbidden: Insufficient permission
- - 404 Not Found: Resource not found
- - 409 Conflict: Duplicate username/email, role has members, etc.
- - 429 Too Many Requests: Rate limited
- - 500 Internal Server Error: Unexpected error
- - 503 Service Unavailable: DB/Redis not connected \*/

/\*\*

- Response Format (Standardized):
-
- Success:
- {
- "success": true,
- "data": {} | [] | null
- }
-
- Error:
- {
- "success": false,
- "error": {
-     "code": "string (machine-readable error code)",
-     "message": "string (human-readable message)"
- }
- } \*/

export {}
