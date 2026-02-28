# Feature Specification: Workspace Settings

**Feature Branch**: `018-workspace-settings`  
**Created**: 2026-02-28  
**Status**: Draft  
**Input**: User description: "Tenant-level workspace configuration system with single-row settings table, JSONB columns for general/language/branding/payment/security, config_version tracking, audit logging, encrypted payment credentials, language fallback, and strict tenant isolation."

---

## User Scenarios & Testing

### User Story 1 – Configure General Workspace Settings (Priority: P1)

An institution administrator opens the Backoffice workspace settings page and configures foundational workspace properties: application display name, timezone, date format, and optional session timeout. These settings determine how dates, times, and the workspace identity are presented across all workspace interfaces.

**Why this priority**: General settings are the baseline configuration every workspace needs before any other settings become meaningful. Timezone and date format affect display across exams, reports, and audit logs.

**Independent Test**: Can be tested by creating a workspace, navigating to settings, saving general settings, and verifying the saved values are returned on subsequent loads and reflected in date/time displays.

**Acceptance Scenarios**:

1. **Given** an authenticated institution admin on the Backoffice settings page, **When** they enter a valid app name, select a timezone, choose a date format, and save, **Then** the settings are persisted, config_version increments by 1, and the saved values are returned on the next load.
2. **Given** an admin submitting general settings with an invalid IANA timezone value, **When** they attempt to save, **Then** the system rejects the update with a clear validation error and does not persist any changes.
3. **Given** an admin submitting general settings without a required field (app_name, timezone, or date_format), **When** they attempt to save, **Then** the system rejects the update with a validation error identifying the missing field.
4. **Given** a workspace with no settings row yet, **When** the admin saves general settings for the first time, **Then** the system creates the settings row with config_version = 1 and records default values for other setting groups.

---

### User Story 2 – Manage Language Settings (Priority: P1)

An institution administrator configures which languages the workspace supports and designates a default language. The default language is the fallback for all content display. Supported languages control which translations are available for content authoring and student-facing interfaces.

**Why this priority**: Language settings affect content authoring, student experience, and translation workflows. The default language fallback is a critical behavioral rule that must be correct from the start.

**Independent Test**: Can be tested by setting a default language plus supported languages, then verifying the default language cannot be removed, that fallback behavior works, and that adding/removing languages does not mutate historical content.

**Acceptance Scenarios**:

1. **Given** an admin configuring language settings, **When** they set default_language to "ar" and supported_languages to ["ar", "en"], **Then** the settings are persisted with config_version incremented.
2. **Given** language settings with default_language = "ar", **When** the admin attempts to remove "ar" from supported_languages, **Then** the system rejects the update with a clear error stating the default language cannot be removed.
3. **Given** supported_languages = ["ar", "en", "fr"], **When** the admin removes "fr" from supported_languages, **Then** the system marks "fr" as inactive but does not delete any existing translations in "fr".
4. **Given** an admin adds a new language "es" to supported_languages, **When** the update is saved, **Then** the system persists the change and signals that translation coverage should be recalculated (no historical content is mutated).
5. **Given** default_language = "ar" and a content item has no translation in the user's preferred language, **When** the content is requested, **Then** the system falls back to displaying the "ar" (default_language) version.

---

### User Story 3 – Update Branding Settings (Priority: P2)

An institution administrator customizes the workspace's visual identity: logo, favicon, primary and secondary brand colors, and optionally email/certificate template branding and SEO metadata. Branding changes are reflected dynamically across Frontoffice and Backoffice interfaces.

**Why this priority**: Branding is essential for white-label delivery but does not block core workspace functionality. It is visual-only and must never influence business logic, permissions, or grading.

**Independent Test**: Can be tested by uploading branding assets, saving colors following the token-based system, and verifying the changes appear in the workspace UI without affecting any non-visual behavior.

**Acceptance Scenarios**:

1. **Given** an admin updating branding with a valid logo_url, favicon_url, and color tokens, **When** they save, **Then** the branding settings are persisted, config_version increments, and the workspace UI reflects the new branding.
2. **Given** an admin submitting a color value that does not conform to the token-based color system, **When** they attempt to save, **Then** the system rejects the update with a validation error.
3. **Given** updated branding settings, **When** any non-branding operation runs (exam grading, permissions, licensing), **Then** the operation is completely unaffected by branding values.

---

### User Story 4 – Configure Payment Gateway Credentials (Priority: P2)

An institution administrator configures a custom payment gateway by enabling it, selecting a provider, and entering API credentials. Credentials are encrypted at rest and never returned in API responses. When gateway is disabled, the Frontoffice subscription runtime reflects the disabled state.

**Why this priority**: Payment configuration is sensitive and requires strict security handling. While not every workspace uses custom payment gateways, the encryption and non-exposure contract is critical for trust.

**Independent Test**: Can be tested by enabling the payment gateway, entering credentials, saving, then verifying credentials are encrypted at rest, never appear in GET responses, and that disabling the gateway is reflected in the Frontoffice.

**Acceptance Scenarios**:

1. **Given** an admin enabling a custom payment gateway and entering a provider, API key, and secret key, **When** they save, **Then** credentials are encrypted before persistence, config_version increments, and the settings are saved.
2. **Given** saved payment settings with encrypted credentials, **When** any user retrieves workspace settings via API, **Then** the response never includes encrypted_api_key or encrypted_secret_key values (they are redacted or omitted).
3. **Given** payment settings with credentials, **When** the audit log for the update is created, **Then** the audit entry does not contain raw or encrypted credential values.
4. **Given** an admin disabling the custom payment gateway (use_custom_payment_gateway = false), **When** the Frontoffice subscription runtime loads, **Then** it reflects that the custom gateway is disabled.
5. **Given** an admin updates payment credentials, **When** the update succeeds, **Then** any cached payment settings are invalidated.

---

### User Story 5 – Manage Security Settings (Priority: P3)

An institution administrator configures workspace-level security policies: analytics opt-in, maximum login attempts, and lockout duration. Analytics opt-in defaults to false and cannot activate without explicit action. Password policy is a future-ready structure that is accepted but not enforced yet.

**Why this priority**: Security settings are important but many have sensible defaults. Analytics opt-in must default to off for privacy compliance. Login attempt limits provide defense against brute-force attacks.

**Independent Test**: Can be tested by saving security settings with various configurations and verifying defaults apply when fields are omitted, analytics opt-in behavior is correct, and login attempt limits are enforced.

**Acceptance Scenarios**:

1. **Given** a new workspace with no explicit security settings, **When** security settings are loaded, **Then** analytics_opt_in defaults to false.
2. **Given** an admin setting max_login_attempts = 5 and lockout_duration_minutes = 15, **When** they save, **Then** the values are persisted and config_version increments.
3. **Given** an admin explicitly setting analytics_opt_in = true, **When** the setting is saved, **Then** the audit log records that analytics opt-in was activated.
4. **Given** a password_policy structure is submitted, **When** saved, **Then** the system accepts and persists the structure without enforcing it (future-ready).

---

### User Story 6 – Audit Trail for All Settings Changes (Priority: P1)

Every settings update creates an immutable audit log entry recording who made the change, what changed, when it changed, and the request context. Audit entries never contain raw credentials or sensitive key material.

**Why this priority**: Auditability is a constitutional requirement. Every configuration change must be traceable for compliance, debugging, and accountability.

**Independent Test**: Can be tested by performing a settings update and verifying the audit log entry contains user_id, workspace_id, changed fields, timestamp, and request_id — and does not contain any sensitive credential data.

**Acceptance Scenarios**:

1. **Given** an admin updates any settings group, **When** the update is committed, **Then** an immutable audit log entry is created with user_id, workspace_id, changed fields, timestamp, and request_id.
2. **Given** an admin updates payment credentials, **When** the audit entry is created, **Then** the entry does not contain plain API keys or encrypted credential values.
3. **Given** multiple sequential settings updates, **When** the audit log is queried, **Then** each update has a distinct entry with the correct config_version at time of change.

---

### User Story 7 – Settings Retrieval with Defaults and Fallback (Priority: P1)

When loading workspace settings at runtime, the system provides sensible defaults for optional fields not yet configured. The system never assumes optional keys are present. If a critical configuration is invalid or missing, the system fails safely rather than using corrupted data.

**Why this priority**: Runtime stability depends on safe defaults and predictable fallback behavior. This protects all downstream consumers of settings data.

**Independent Test**: Can be tested by loading settings with partially configured data and verifying defaults are applied for missing optional fields, and that invalid critical configuration triggers a safe failure.

**Acceptance Scenarios**:

1. **Given** a workspace with settings where session_timeout_minutes is not set, **When** settings are loaded, **Then** the system applies a sensible default value for session timeout.
2. **Given** a workspace with settings where a required critical field (e.g., timezone) is corrupted or missing, **When** settings are loaded, **Then** the system returns a clear error rather than silently using invalid data.
3. **Given** a settings response, **When** the response is returned, **Then** all optional fields that are not configured have reasonable defaults applied (not null or undefined).

---

### Edge Cases

- What happens when two admins update settings concurrently? The system must handle this transactionally — one update succeeds and increments config_version, the other must either retry or receive a conflict error.
- What happens when an admin attempts to set default_language to a language not in supported_languages? The system must reject the update.
- What happens when branding URLs point to inaccessible resources? The system persists the URLs but the UI gracefully handles missing assets (broken image fallback).
- What happens when the encryption service for payment credentials is unavailable? The update must fail entirely rather than storing plain-text credentials.
- What happens when the settings row is accidentally deleted? The system must handle the missing row gracefully by creating a new one with defaults on next access or returning a clear error.
- What happens when a JSONB column contains malformed JSON from a migration error? The system must detect invalid JSON and fail safely rather than crashing.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST store workspace settings in a single-row table within the tenant database only. No master database access is permitted.
- **FR-002**: System MUST enforce single-row constraint per workspace using a unique constraint on a constant key or equivalent enforcement pattern.
- **FR-003**: System MUST store settings in five JSONB columns: general_settings, language_settings, branding_settings, payment_settings, and security_settings.
- **FR-004**: System MUST increment config_version (integer) on every successful settings update.
- **FR-005**: System MUST validate all settings against their defined JSON schema before persisting any update. No partial updates are allowed — validation must pass for the entire settings object before commit.
- **FR-006**: System MUST execute all settings updates within a database transaction.
- **FR-007**: System MUST update the updated_at timestamp on every settings change using server-authoritative time.

- **FR-008**: general_settings MUST require app_name (string), timezone (valid IANA timezone string), and date_format (string). session_timeout_minutes (integer) is optional.
- **FR-009**: language_settings MUST require default_language (string) and supported_languages (array of strings). default_language MUST exist within supported_languages.
- **FR-010**: System MUST reject any update that removes default_language from supported_languages.
- **FR-011**: Removing a language from supported_languages MUST NOT delete existing translations — it MUST mark the language as inactive.
- **FR-012**: Adding a new supported language MUST trigger translation coverage recalculation without mutating historical content.

- **FR-013**: branding_settings MUST support logo_url, favicon_url, primary_color, and secondary_color. Optional fields include email_template_branding, certificate_template_branding, and seo_metadata.
- **FR-014**: Branding settings MUST be visual-only. They MUST NOT influence business logic, permissions, grading, or module enablement.
- **FR-015**: Color values MUST conform to the token-based color system. No inline styling values are allowed.

- **FR-016**: payment_settings MUST support use_custom_payment_gateway (boolean), gateway_provider (string or null), encrypted_api_key (string or null), and encrypted_secret_key (string or null).
- **FR-017**: Payment API credentials MUST be encrypted at rest before persistence. The encryption key MUST NOT be stored in the tenant database.
- **FR-018**: Payment credentials (encrypted_api_key, encrypted_secret_key) MUST NEVER be returned in any API response.
- **FR-019**: Payment credentials MUST NEVER appear in log output or audit log entries.
- **FR-020**: Updating payment credentials MUST invalidate any cached payment settings.
- **FR-021**: If the encryption service is unavailable, the settings update MUST fail entirely rather than storing plain-text credentials.

- **FR-022**: security_settings MUST support analytics_opt_in (boolean, default false), max_login_attempts (integer), lockout_duration_minutes (integer), and password_policy (future-ready structure).
- **FR-023**: analytics_opt_in MUST default to false. Cross-workspace aggregated reporting MUST NOT activate without explicit opt-in.
- **FR-024**: password_policy structure MUST be accepted and persisted but not enforced (future-ready).

- **FR-025**: Every settings update MUST create an immutable audit log entry containing user_id, workspace_id, changed fields, timestamp, and request_id.
- **FR-026**: Audit log entries MUST NOT contain raw or encrypted payment credentials.
- **FR-027**: Audit log entries MUST be immutable — no updates or deletes.

- **FR-028**: Settings retrieval MUST be indexed and return within performance targets.
- **FR-029**: Runtime MUST apply sensible defaults for optional fields that are not configured.
- **FR-030**: Runtime MUST fail safely if critical configuration is missing or invalid, rather than using corrupted data.
- **FR-031**: Settings MUST be loaded from tenant database only and attached to request context. No global cross-tenant caching is permitted.
- **FR-032**: If per-tenant in-memory cache is used in future, it MUST be invalidated on config_version change.
- **FR-033**: All workspace settings routes MUST pass through tenant resolver and license enforcement middleware before access is granted.

### Key Entities

- **Workspace Settings**: A single-row configuration record per tenant workspace. Contains five JSONB setting groups (general, language, branding, payment, security) plus a config_version counter, created_at, and updated_at timestamps. Lives exclusively in tenant database.
- **Settings Audit Log Entry**: An immutable record of every settings change. Contains actor identity (user_id), workspace context (workspace_id), the fields that changed, server-authoritative timestamp, and request correlation ID. Never contains sensitive credentials.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Institution administrators can view and update all five settings groups (general, language, branding, payment, security) within a single workspace settings interface in under 30 seconds per group.
- **SC-002**: Every settings update produces a verifiable audit trail entry that includes the actor, changed fields, and timestamp — 100% of updates are audited.
- **SC-003**: Payment credentials are never exposed in any user-facing response, log output, or audit entry — verified by security review with zero credential leakage incidents.
- **SC-004**: Language fallback behavior is deterministic — when content lacks a translation in the requested language, the default language version is served 100% of the time.
- **SC-005**: Settings retrieval completes within 50ms under normal load conditions.
- **SC-006**: Concurrent settings updates by multiple administrators are handled without data corruption — every update either succeeds with correct config_version or returns a clear conflict indication.
- **SC-007**: Workspace settings for one tenant are never accessible or influenced by operations in another tenant — verified by isolation tests with zero cross-tenant leakage.
- **SC-008**: Branding changes are reflected in the workspace UI without requiring page reload or cache purge by the administrator.
- **SC-009**: Removing a supported language preserves 100% of existing translations — no data loss occurs.
- **SC-010**: The system handles missing or corrupted settings gracefully — no unhandled errors or crashes when optional configuration is absent.

---

## Assumptions

- IANA timezone validation uses the standard IANA Time Zone Database (e.g., "Asia/Riyadh", "America/New_York").
- Date format values follow a commonly understood format pattern (e.g., "DD/MM/YYYY", "YYYY-MM-DD") — specific format strings will be defined during planning.
- The encryption mechanism for payment credentials is an application-level service (not database-level encryption) and the encryption key is managed via environment/secrets management, not stored in any database.
- Session timeout default (when not configured) is a reasonable platform default (e.g., 30 minutes) — exact value to be defined during planning.
- Translation coverage recalculation on adding a language is an asynchronous signal/event, not a synchronous blocking operation.
- The single-row enforcement pattern will be determined during planning (constant key with unique constraint vs. check constraint vs. application-level enforcement).
- Audit log storage is in the tenant database (same database as workspace_settings) to maintain tenant isolation.
- The token-based color system for branding accepts standard hex color codes or CSS custom property references — exact format to be defined during planning.
- "Fail safely" for invalid critical config means returning a structured error response rather than a default value — the system should not silently serve wrong timezone/date format data.
- MMC billing logic is unaffected by workspace-level payment gateway settings (MMC has its own billing path).
