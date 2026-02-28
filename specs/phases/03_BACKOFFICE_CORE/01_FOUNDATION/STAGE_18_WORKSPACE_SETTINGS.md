# STAGE 18 – Workspace Settings

Phase: 03_BACKOFFICE_CORE  
Domain: 01_FOUNDATION  
Scope: Tenant-level configuration system  
Database: Tenant DB only

---

## Stage Status

Status: DRAFT
Risk Level: LOW
Last Updated: 2026-02-28T19:20:00Z

Scope Planned:

- Migration: ALTER workspace_settings + CREATE workspace_settings_audit
- 3 API endpoints (GET settings, PUT group, GET audit) under /api/v1/backoffice/
- AES-256-GCM encryption for payment credentials
- Optimistic locking with config_version
- Full-diff immutable audit logging
- Cursor-based audit pagination

Deferred Scope:

- Password policy enforcement (future-ready structure only)
- Encryption key rotation (future stage)
- Translation management UI (separate stage)

Constitutional Compliance:

- Technical plan compliant — task generation authorized

Notes:
Technical plan complete. Task breakdown in progress.

---

## 1. Objective

Implement a deterministic, auditable, and extensible workspace configuration system.

Workspace settings must be:

- Strictly tenant-isolated
- Version-aware
- Auditable
- Cache-safe
- Backward compatible
- Schema-controlled

No master_db access is allowed in this stage.

Workspace settings must never affect other tenants.

---

## 2. Architectural Principles

Workspace settings must:

- Live entirely inside tenant DB
- Be loaded at runtime through tenant context
- Never be globally cached without workspace scoping
- Support future extension without schema breaking

Settings must not:

- Control license lifecycle
- Override product module configuration
- Bypass license enforcement
- Alter multi-tenancy rules

---

## 3. Settings Storage Model

Recommended model:

Single table:
workspace_settings

Structure:

- id (PK)
- config_version (integer)
- general_settings (JSONB)
- language_settings (JSONB)
- branding_settings (JSONB)
- payment_settings (JSONB)
- security_settings (JSONB)
- created_at
- updated_at

Only one active row allowed per workspace.

Enforce via:

- Unique constraint on constant key OR
- Single-row enforcement pattern

---

## 4. Configuration Contract

### 4.1 General Settings

general_settings JSON must include:

- app_name (string, required)
- timezone (string, required)
- date_format (string, required)
- session_timeout_minutes (integer, optional)

Timezone must use valid IANA timezone values.

---

### 4.2 Language Settings

language_settings JSON must include:

- default_language (string, required)
- supported_languages (array of strings, required)

Rules:

- default_language must exist in supported_languages
- Cannot remove default_language
- Removing a supported language must:
  - Not delete translations
  - Mark language inactive
- Fallback logic must always use default_language

Adding language must:

- Trigger translation coverage recalculation
- Not mutate historical content

---

### 4.3 Branding Settings

branding_settings JSON must include:

- logo_url
- favicon_url
- primary_color
- secondary_color
- email_template_branding (optional)
- certificate_template_branding (optional)
- seo_metadata (optional)

Branding rules:

- Visual only
- Must not change business logic
- Must not alter module enablement
- Must not alter permissions
- Must not affect grading

Color values must follow token-based system.
No inline styling allowed.

---

### 4.4 Payment Settings

payment_settings JSON must include:

- use_custom_payment_gateway (boolean)
- gateway_provider (string | null)
- encrypted_api_key (string | null)
- encrypted_secret_key (string | null)

Security rules:

- API credentials must be encrypted at rest
- Encryption key must not be stored in tenant DB
- Credentials must never be returned in API responses
- Credentials must never appear in logs
- Updating credentials must invalidate cache

If gateway disabled:

- Frontoffice subscription runtime must reflect disabled state
- MMC billing logic remains unaffected

---

### 4.5 Security Settings

security_settings JSON may include:

- analytics_opt_in (boolean)
- password_policy (future-ready structure)
- max_login_attempts (integer)
- lockout_duration_minutes (integer)

analytics_opt_in controls:

- Cross-workspace aggregated reporting
- Must default to false

Analytics cannot activate without explicit opt-in.

---

## 5. Versioning Model

workspace_settings must include:

config_version (integer)

Rules:

- Increment config_version on every update
- Runtime may cache settings per request
- Cache must invalidate when config_version changes
- Backward compatibility must be preserved

Settings migration must be handled via tenant schema migration model.

---

## 6. Update Flow Rules

Settings updates must:

- Be transactional
- Validate JSON schema before persistence
- Log audit entry
- Increment config_version
- Update updated_at timestamp

No partial update allowed.

All updates must be full validation before commit.

---

## 7. Audit Logging

Every settings update must:

- Log user_id
- Log workspace_id
- Log changed fields
- Log timestamp
- Log request_id

Audit logs must not store:

- Raw encrypted credentials
- Plain API keys

Audit entries must be immutable.

---

## 8. Runtime Loading Rules

Settings must be:

- Loaded via tenant DB only
- Attached to request context
- Not globally cached across tenants
- Not stored in static variables

Runtime must:

- Use default fallback if optional field missing
- Never assume presence of optional keys
- Fail safely if critical config invalid

---

## 9. Performance Constraints

Settings retrieval must:

- Be indexed
- Return in < 50ms
- Avoid full table scans

If future scaling requires:

- Introduce per-tenant in-memory cache
- Cache must be invalidated on config_version change

Cross-tenant shared cache is prohibited.

---

## 10. Validation Criteria

Stage complete when:

- Settings persist correctly
- Language fallback works deterministically
- Removing default language is blocked
- Branding updates reflect dynamically
- Payment credentials encrypted
- API never returns secrets
- Audit log records all updates
- config_version increments correctly
- No master_db queries occur

---

## 11. Not Allowed

- Hardcoded language assumptions
- Hardcoded theme values
- Plain-text payment credentials
- Cross-tenant caching
- Master DB dependency
- Settings controlling license lifecycle
- Settings altering product modules
- Business logic embedded in settings layer

---

## 12. Isolation Principle

Workspace settings are tenant-local configuration.

They must never:

- Influence other tenants
- Influence platform lifecycle
- Bypass license enforcement
- Override product structure

Settings are configuration only.

Business rules remain in domain layer.
