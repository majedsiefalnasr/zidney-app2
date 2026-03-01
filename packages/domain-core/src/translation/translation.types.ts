/**
 * Translation System — TypeScript Type Definitions
 *
 * File: packages/domain-core/src/translation/translation.types.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Pure type definitions for the tenant-scoped translation system.
 * No runtime code, no imports from framework or DB.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure type definitions only
 * ✓ No DB imports — types are layer-agnostic
 * ✓ No framework dependencies
 */

// ---------------------------------------------------------------------------
// Translation — Core Row Shape
// ---------------------------------------------------------------------------

/**
 * A single translation row as it exists in the `translations` tenant table.
 * Represents a translated value for a specific entity field in a non-default language.
 */
export interface Translation {
  /** Server-generated UUID primary key */
  id: string
  /** Entity type (e.g. 'subject', 'category', 'question', 'exam') */
  entity_type: string
  /** UUID of the entity in the tenant DB */
  entity_id: string
  /** Field name within the entity (e.g. 'title', 'description') */
  field_name: string
  /** ISO 639-1 language code (e.g. 'fr', 'ar') - never the default language */
  language_code: string
  /**
   * The translated value. Empty string '' is valid (intentional blank).
   * NULL is never stored in the DB.
   */
  translated_value: string
  /** Server-authoritative creation timestamp */
  created_at: string
  /** Server-authoritative last-update timestamp */
  updated_at: string
}

// ---------------------------------------------------------------------------
// TranslationUpsert — Write Input Shape
// ---------------------------------------------------------------------------

/**
 * Input shape for upserting a single translation field.
 * Used by `upsertTranslations()` and the POST /translations API endpoint.
 * The composite key (entity_type, entity_id, field_name, language_code) is
 * the idempotency key — submitting the same key twice updates the value.
 */
export interface TranslationUpsert {
  /** Entity type — must be registered in TRANSLATABLE_FIELDS */
  entity_type: string
  /** UUID of the entity to translate */
  entity_id: string
  /** Field name — must be valid for the given entity_type */
  field_name: string
  /** ISO 639-1 language code — must be in workspace supported_languages; must NOT be default_language */
  language_code: string
  /**
   * Target translated value.
   * Empty string '' is a valid intentional blank.
   * Null is NOT accepted (enforced at API validation layer).
   */
  translated_value: string
}

// ---------------------------------------------------------------------------
// TranslationCoverage — Coverage Aggregation
// ---------------------------------------------------------------------------

/**
 * Translation coverage for a specific (entity_type, language_code) combination.
 * Used by `getCoverage()` and the GET /translations/coverage endpoint.
 * The default language is never included in coverage results (FR-020).
 */
export interface TranslationCoverage {
  /** Entity type */
  entity_type: string
  /** ISO 639-1 language code */
  language_code: string
  /** Number of entity-field slots that have a translation row */
  translated_count: number
  /** Distinct entity count (e.g., number of questions) */
  total_entities: number
  /** Percentage (0–100, two decimal places) */
  coverage_percent: number
}

// ---------------------------------------------------------------------------
// TranslationAuditEntry — Audit Log Row Shape
// ---------------------------------------------------------------------------

/**
 * A single audit log entry from the `translation_audit_logs` tenant table.
 * Immutable — inserted once, never updated or deleted (trigger-enforced).
 */
export interface TranslationAuditEntry {
  /** Server-generated UUID primary key */
  id: string
  /** Workspace UUID — passed as data, no FK */
  workspace_id: string
  /** Entity type */
  entity_type: string
  /** Entity UUID */
  entity_id: string
  /** Field name */
  field_name: string
  /** ISO 639-1 language code */
  language_code: string
  /** Write action */
  action: 'created' | 'updated' | 'deleted'
  /**
   * Value before the change.
   * NULL for 'created' actions.
   * IMPORTANT: Must never appear in structured log output.
   */
  previous_value: string | null
  /**
   * Value after the change.
   * NULL for 'deleted' actions.
   * IMPORTANT: Must never appear in structured log output.
   */
  new_value: string | null
  /** Staff user ID who performed the operation */
  user_id: string
  /** Request correlation ID */
  correlation_id: string
  /** Optional reason code (e.g. 'language_removed') */
  reason: string | null
  /** Server-authoritative creation timestamp */
  created_at: string
}

// ---------------------------------------------------------------------------
// TranslationOperationContext — Service-Layer Context
// ---------------------------------------------------------------------------

/**
 * Context object passed to all translation service methods.
 * Contains workspace-level configuration and request-level metadata.
 * Injected from the API route handler (never constructed from user input).
 */
export interface TranslationOperationContext {
  /** Workspace UUID */
  workspace_id: string
  /** Workspace slug */
  workspace_slug: string
  /** Staff user ID performing the operation */
  user_id: string
  /** Request correlation ID for structured logging */
  correlation_id: string
  /** Default language code for this workspace (e.g. 'ar') */
  default_language: string
  /** Full list of supported language codes for this workspace */
  supported_languages: string[]
  /**
   * Per-language operational status.
   * Key: language_code, Value: 'active' | 'removing'
   * Absence of a key is equivalent to 'active'.
   */
  language_status?: Record<string, 'active' | 'removing'>
}

// ---------------------------------------------------------------------------
// ResolvedEntityTranslations — Fallback Resolution Result
// ---------------------------------------------------------------------------

/**
 * Result of `resolveEntityTranslations()` — the entity fields with fallback applied.
 * Returned by GET /translations?entity_type=X&entity_id=Y&language_code=Z (Mode A).
 */
export interface ResolvedEntityTranslations {
  /** Entity type */
  entity_type: string
  /** Entity UUID */
  entity_id: string
  /** Requested language code */
  language_code: string
  /**
   * Resolved field values.
   * For each field in TRANSLATABLE_FIELDS[entity_type]:
   *   - Translation row exists → translated_value
   *   - Row absent → base entity value (fallback, FR-011)
   *   - Both absent → '' with warning log (FR-012)
   */
  fields: Record<string, string>
  /**
   * Field names that fell back to the default-language base entity value.
   * Empty array when all fields have translations.
   */
  fallback_fields: string[]
}
