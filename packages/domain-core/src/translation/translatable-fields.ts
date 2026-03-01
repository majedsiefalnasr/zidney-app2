/**
 * Translation System — Translatable Fields Registry
 *
 * File: packages/domain-core/src/translation/translatable-fields.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Defines the canonical set of translatable fields per entity type.
 * Single source of truth for:
 *   1. Field validation in translation write operations
 *   2. Coverage denominator calculation (no DB overhead)
 *   3. Translation panel field listing
 *
 * To add a new entity type or field:
 *   1. Add entry to TRANSLATABLE_FIELDS
 *   2. Bump packages/domain-core package minor version
 *   3. No DB migration required (translations table accepts any entity_type string)
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure constants and utility functions
 * ✓ No DB imports
 * ✓ No framework dependencies
 */

// ---------------------------------------------------------------------------
// TRANSLATABLE_FIELDS Registry
// ---------------------------------------------------------------------------

/**
 * Canonical map of entity_type → translatable field names.
 *
 * Coverage denominator = TRANSLATABLE_FIELDS[entity_type].length
 * Field validation: field_name must appear in TRANSLATABLE_FIELDS[entity_type]
 *
 * This is a `satisfies` assertion — TypeScript will type-check that the value
 * conforms to Record<string, readonly string[]> while preserving the literal types.
 */
export const TRANSLATABLE_FIELDS = {
  subject: ['title', 'description'],
  category: ['name', 'description'],
  question: ['text', 'explanation'],
  exam: ['title', 'description', 'instructions'],
} as const satisfies Record<string, readonly string[]>

// ---------------------------------------------------------------------------
// Derived Types
// ---------------------------------------------------------------------------

/** Union of all registered entity type strings */
export type TranslatableEntityType = keyof typeof TRANSLATABLE_FIELDS

/** Union of all field names for a given entity type T */
export type TranslatableFieldName<T extends TranslatableEntityType> =
  (typeof TRANSLATABLE_FIELDS)[T][number]

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Returns the list of translatable fields for the given entity_type.
 * Returns an empty readonly array for unknown / unregistered entity types.
 * Callers should emit a warning log when the result is empty.
 *
 * @param entityType - Any string; safe to call with unknown values
 * @returns Readonly array of field names, or [] for unknown types
 */
export function getTranslatableFields(entityType: string): readonly string[] {
  return (
    (TRANSLATABLE_FIELDS as Record<string, readonly string[]>)[entityType] ?? []
  )
}

/**
 * Returns true if the given entity_type is a registered translatable entity.
 * Type guard — narrows to TranslatableEntityType.
 *
 * @param entityType - Any string to check
 */
export function isTranslatableEntityType(
  entityType: string
): entityType is TranslatableEntityType {
  return entityType in TRANSLATABLE_FIELDS
}
