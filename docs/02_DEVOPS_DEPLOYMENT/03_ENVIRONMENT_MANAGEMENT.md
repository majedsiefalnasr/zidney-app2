# Environment Management

Phase Alignment: Platform Foundation – Infrastructure Governance  
Scope: Secret management, environment isolation, and runtime configuration  
Status: Enforced

---

## Environment Separation Model

Zidney must operate under strict environment isolation.

Environments:

- local
- staging (future)
- production

Each environment must have:

- Separate PostgreSQL instance or database namespace
- Separate Redis instance or namespace
- Separate JWT secrets
- Separate encryption keys
- Separate rate limit secrets

No environment may share secrets.

---

## Local Development

Local environment file:

.env.local

Used by:

- Docker Compose
- API container
- Worker container

Rules:

- Local secrets are for development only
- Local DB must not contain production data
- Developers must never use production credentials locally

---

## Production

Production environment file:

.env.production

Rules:

- Must not be committed to Git
- Must be stored securely on VPS
- Must have restricted file permissions
- Must be backed up securely
- Must not be copied between servers without rotation

---

## Secret Injection Strategy

Secrets must be injected via:

- Docker environment variables
- VPS-level secret management
- CI/CD secret store (future)

Secrets must never be:

- Hardcoded in source code
- Logged
- Sent to frontend
- Embedded in Docker images

---

## Required Environment Variables

### Core Backend Variables

- DATABASE_MASTER_URL
- DATABASE_TENANT_HOST
- DATABASE_TENANT_PORT
- DATABASE_TENANT_USER
- DATABASE_TENANT_PASSWORD
- PGBOUNCER_HOST
- PGBOUNCER_PORT
- REDIS_URL
- JWT_SECRET
- ENCRYPTION_SECRET
- RATE_LIMIT_SECRET
- WORKER_SECRET
- NODE_ENV

### API Runtime Controls

- PLATFORM_SCHEMA_VERSION
- MIN_SUPPORTED_SCHEMA_VERSION
- MAX_CONNECTIONS_PER_TENANT
- SOFT_LOCK_DAYS

### Frontend Variables

- VITE_API_URL
- VITE_APP_ENV
- VITE_DEFAULT_THEME

Frontend must not receive any secret keys.

---

## JWT Secret Rules

- Must be strong and random
- Must be at least 256-bit entropy
- Must differ per environment
- Must be rotated immediately if breach suspected

Token invalidation must be supported via token_version field.

---

## Encryption Secret Rules

Used for:

- Encrypting db_password in master_db
- Sensitive configuration values

Rules:

- Must not equal JWT_SECRET
- Must be rotated with migration plan
- Must never be logged

---

## Rate Limiting Secret

Used for:

- Hashing rate-limit keys
- Protecting distributed rate limiting

Must not be exposed to frontend.

---

## Secret Rotation Policy

If compromise suspected:

1. Rotate JWT_SECRET
2. Rotate ENCRYPTION_SECRET
3. Invalidate all tokens
4. Force re-authentication
5. Log incident
6. Record in incident register

Annual rotation recommended even without breach.

---

## Environment Validation on Boot

API must validate on startup:

- All required environment variables exist
- No placeholder values in production
- NODE_ENV correctly set
- Platform schema version defined

If validation fails:
→ Application must refuse to boot.

---

## Hard Rules

- No default secret values allowed
- No fallback secret generation in production
- No environment auto-detection based on host
- No mixing local and production variables
- No using development secrets in production

Environment management is a security boundary.
