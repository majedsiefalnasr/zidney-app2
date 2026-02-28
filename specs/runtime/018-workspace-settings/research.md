# Research: Workspace Settings

**Branch**: `018-workspace-settings` | **Date**: 2026-02-28  
**Spec**: `specs/runtime/018-workspace-settings/spec.md`

---

## Research Tasks & Findings

### R-001: Single-Row Enforcement Pattern

**Question**: What pattern should enforce the single-row constraint on workspace_settings?

**Decision**: Use a CHECK constraint with a constant singleton key column.

**Rationale**: The existing baseline migration (`baseline_004_workspace_settings.sql`) uses a trigger-based singleton check. However, the trigger fires AFTER INSERT and races are possible. A more robust approach:

- Add a column `singleton_key VARCHAR(10) NOT NULL DEFAULT 'SETTINGS' CHECK (singleton_key = 'SETTINGS')` with a UNIQUE constraint.
- This makes the DB reject duplicate rows at constraint level (not trigger-level).
- Simpler, faster, deterministic.

**Alternatives considered**:

- Trigger-based singleton (current baseline) — race-prone under concurrent inserts, more complex DDL.
- Application-level enforcement only — insufficient; DB must be authoritative.
- View-based with a single-value primary key — works but less explicit than CHECK + UNIQUE.

---

### R-002: JSONB Column Validation Strategy with Drizzle

**Question**: How should JSONB columns be validated with Drizzle ORM and Zod in the Zidney stack?

**Decision**: Validate at the application layer using Zod schemas before persistence. Drizzle's `jsonb()` column type stores raw JSON; validation is the service layer's responsibility.

**Rationale**:

- Drizzle ORM supports `jsonb()` columns via `drizzle-orm/pg-core`.
- The existing codebase uses JSONB in migrations (audit logs metadata, attempt results, products name).
- PostgreSQL validates JSON structure at insert time (rejects malformed JSON) but not schema.
- Zod schemas provide compile-time TypeScript types AND runtime validation — double protection.
- No database-level JSON Schema constraints needed; Zod is the single validation authority.

**Alternatives considered**:

- PostgreSQL CHECK constraints with jsonb_typeof — fragile, hard to maintain, cannot express complex nested schemas.
- Database-level JSON Schema validation (pg_jsonschema extension) — adds external dependency, not used in Zidney today.

---

### R-003: Encryption Approach for Payment Credentials

**Question**: What encryption primitive and pattern should be used for payment credential encryption at rest?

**Decision**: AES-256-GCM via Node.js/Bun `crypto` module. Store as `{keyId}:{iv}:{authTag}:{ciphertext}` base64-encoded string.

**Rationale**:

- AES-256-GCM is authenticated encryption — provides confidentiality + integrity + authentication.
- Bun supports the standard Node.js `crypto` module (including `createCipheriv`/`createDecipheriv`).
- The key identifier prefix satisfies CL-005 (future key rotation support).
- The encryption key is loaded from environment/secrets (`WORKSPACE_SETTINGS_ENCRYPTION_KEY`), never stored in any database.
- No third-party encryption libraries needed — `crypto` is built-in.

**Format**: `v1:<base64_iv>:<base64_authTag>:<base64_ciphertext>`

Where `v1` is the key identifier, enabling future rotation by introducing `v2`, `v3`, etc.

**Alternatives considered**:

- AES-256-CBC — no authentication tag; vulnerable to padding oracle attacks. Rejected.
- libsodium/tweetnacl — higher-level API but adds external dependency. Rejected for simplicity.
- Database-level pgcrypto — encryption key would need to be in SQL statements/connection. Rejected per FR-017.
- AWS KMS / Vault integration — overkill for this stage; future enhancement. Deferred.

---

### R-004: Optimistic Locking Implementation with Drizzle

**Question**: How should optimistic locking with `config_version` be implemented in Drizzle?

**Decision**: Use conditional UPDATE with WHERE clause matching `config_version`. Check `rowCount` to detect conflicts.

**Rationale**:

- Pattern: `UPDATE workspace_settings SET ... WHERE singleton_key = 'SETTINGS' AND config_version = :expected_version`
- If `rowCount === 0`, the version has changed → return HTTP 409.
- Drizzle supports `.where(and(eq(...), eq(...)))` syntax for conditional updates.
- The update atomically increments `config_version` (set to `expected + 1`), so concurrent updates are serialized by PostgreSQL row locking.
- No SELECT FOR UPDATE needed — the conditional UPDATE is sufficient and more efficient.

**Alternatives considered**:

- SELECT FOR UPDATE + compare + UPDATE — heavier, holds lock longer. Rejected.
- PostgreSQL advisory locks — overkill for single-row updates. Rejected.
- Last-write-wins — violates CL-001 requirement for conflict detection. Rejected.

---

### R-005: Audit Log Diff Generation

**Question**: How should the full diff (old value → new value) for audit entries be generated?

**Decision**: Compute diff at the service layer by comparing old and new JSONB objects field-by-field. Store as an array of `{ field, old_value, new_value }` entries.

**Rationale**:

- CL-002 requires field names + old/new values.
- The diff is computed BEFORE the database write, within the same transaction.
- Payment credential fields are always redacted: `{ field: "encrypted_api_key", old_value: "[REDACTED]", new_value: "[REDACTED]" }`.
- Shallow diff is sufficient — settings groups are flat or one-level nested.
- Deep comparison for arrays (e.g., `supported_languages`) captures add/remove changes.

**Implementation**:

```typescript
function computeSettingsDiff(
  group: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  redactedFields: string[]
): AuditDiffEntry[]
```

**Alternatives considered**:

- PostgreSQL trigger-based audit — cannot redact payment fields before insertion. Rejected.
- Third-party diff library (deep-diff, jsondiffpatch) — unnecessary dependency for shallow comparison. Rejected.
- Store full before/after snapshots — violates CL-002 "full diff" requirement and wastes storage. Rejected.

---

### R-006: IANA Timezone Validation

**Question**: How should IANA timezone strings be validated?

**Decision**: Use `Intl.supportedValuesOf('timeZone')` (available in Bun) to get the list of valid IANA timezones and validate against it.

**Rationale**:

- `Intl.supportedValuesOf('timeZone')` is a standard ECMAScript API, supported in Bun.
- Returns ~400+ IANA timezone identifiers.
- No external timezone database or package needed.
- Cache the list at module load (it's static for a given runtime version).

**Alternatives considered**:

- `moment-timezone` — heavy dependency, not needed for validation only. Rejected.
- Hardcoded timezone list — goes stale, maintenance burden. Rejected.
- Regex pattern — cannot validate actual IANA names. Rejected.

---

### R-007: Color Token Validation Format

**Question**: What format should the token-based color system accept?

**Decision**: Accept standard 6-digit hex color codes (`#RRGGBB`) and optionally 8-digit with alpha (`#RRGGBBAA`). CSS custom property references (`var(--brand-primary)`) are NOT accepted — colors are stored as resolved values.

**Rationale**:

- Hex colors are universally supported and unambiguous.
- The spec says "token-based color system" — this means colors are stored as design tokens (named values), not CSS variables.
- The API stores the resolved hex value; the frontend maps it to CSS custom properties.
- Regex validation: `/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/`

**Alternatives considered**:

- HSL values — harder to validate, less common in APIs. Rejected.
- CSS custom property names — couples API to frontend implementation. Rejected.
- Named colors (e.g., "red") — ambiguous, not suitable for brand identity. Rejected.

---

### R-008: Date Format Strings

**Question**: What date format string values should be accepted?

**Decision**: Accept a predefined enum of common date format patterns.

**Accepted values**:

- `YYYY-MM-DD` (ISO 8601)
- `DD/MM/YYYY` (Europe/Middle East)
- `MM/DD/YYYY` (US)
- `DD-MM-YYYY`
- `DD.MM.YYYY` (German/Swiss)

**Rationale**:

- A fixed enum is safer than arbitrary format strings.
- These cover the primary institutional markets (Saudi Arabia, Middle East, US, Europe).
- The backend stores the pattern string; the frontend interprets it for display.

**Alternatives considered**:

- Free-form format strings (e.g., Moment.js patterns) — too permissive, validation burden. Rejected.
- Unicode CLDR locale-based formatting — complex, overkill for workspace-level setting. Rejected.

---

### R-009: Session Timeout Default Value

**Question**: What should the default session timeout be when not configured?

**Decision**: 30 minutes. Matches the existing `baseline_004` migration default.

**Rationale**:

- The existing baseline migration sets `session_timeout_minutes = 30`.
- 30 minutes is a widely accepted session timeout for educational platforms.
- Configurable per workspace via security or general settings.

---

### R-010: Migration Strategy for Evolving workspace_settings

**Question**: How do we handle the existing `baseline_004_workspace_settings` table vs. the new JSONB-based schema?

**Decision**: Create a new forward-only migration that ALTERs the existing table — adding JSONB columns, `config_version`, and `singleton_key` while preserving backward-compatible columns. Migrate existing column values into the new JSONB structure.

**Rationale**:

- The baseline table exists with flat columns (organization_name, student_limit, etc.).
- A new migration adds the five JSONB columns alongside existing columns.
- Data migration step copies existing values into the JSONB columns.
- Old columns are NOT dropped (forward-only; dropping is a future migration).
- `config_version INTEGER NOT NULL DEFAULT 1` added.
- `singleton_key` with CHECK + UNIQUE added for robust singleton enforcement.

**Forward-only mandate**: Per Zidney constitution, migrations are forward-only. No existing columns are removed. The new migration coexists with the baseline.

---

### R-011: Workspace Settings Audit Table vs. Existing audit_logs

**Question**: Should workspace settings audit entries go into the existing `audit_logs` table or a dedicated `workspace_settings_audit` table?

**Decision**: Use a dedicated `workspace_settings_audit` table.

**Rationale**:

- The existing `audit_logs` table is purpose-built for authentication events (login, token, RBAC) with a CHECK constraint on `event_type` limiting to auth-related values.
- Workspace settings audit has different fields (settings_group, config_version, changes diff).
- A dedicated table avoids modifying the existing audit_logs schema and its CHECK constraint.
- Maintains separation of concerns and allows independent indexing/retention policies.
- Consistent with Zidney's approach of purpose-specific audit tables (master has `mmc_audit_log`, tenant has `audit_logs`).

**Alternatives considered**:

- Extend existing `audit_logs` with new event types — requires altering CHECK constraint on existing table (breaks forward-only rule for that migration). Rejected.
- General-purpose flexible audit table — loses type safety and makes querying harder. Rejected.
