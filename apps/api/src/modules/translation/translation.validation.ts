/**
 * Translation API Validation Schemas
 *
 * File: apps/api/src/modules/translation/translation.validation.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Zod schemas for translation API request validation.
 *
 * Constitutional Compliance:
 * ✓ All inputs validated with Zod before any DB or domain service call
 * ✓ translated_value limited to 10,000 chars (S-M1 / task T012)
 * ✓ Batch size capped at 50 items (rate-limit enforced at middleware layer)
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Entity ID validation (UUID v4)
// ---------------------------------------------------------------------------

const uuidSchema = z.string().uuid('entity_id must be a valid UUID')

// ---------------------------------------------------------------------------
// Language code validation (ISO 639-1 / BCP-47 basic)
// ---------------------------------------------------------------------------

const languageCodeSchema = z
  .string()
  .min(2, 'language_code must be at least 2 characters')
  .max(10, 'language_code must not exceed 10 characters')
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'language_code must be a valid BCP-47 code (e.g. "en", "pt-BR")')

// ---------------------------------------------------------------------------
// Single upsert item schema
// ---------------------------------------------------------------------------

export const TranslationUpsertItemSchema = z.object({
  entity_type: z
    .string()
    .min(1, 'entity_type is required')
    .max(64, 'entity_type must not exceed 64 characters'),

  entity_id: uuidSchema,

  field_name: z
    .string()
    .min(1, 'field_name is required')
    .max(64, 'field_name must not exceed 64 characters'),

  language_code: languageCodeSchema,

  /**
   * translated_value is validated for length only.
   * It MUST NOT be logged at any tier (security: content confidentiality).
   */
  translated_value: z
    .string()
    .min(1, 'translated_value must not be empty')
    .max(10_000, 'translated_value must not exceed 10,000 characters'),
})

export type TranslationUpsertItem = z.infer<typeof TranslationUpsertItemSchema>

// ---------------------------------------------------------------------------
// Single upsert request body
// ---------------------------------------------------------------------------

export const SingleUpsertSchema = z.object({
  items: z.array(TranslationUpsertItemSchema).min(1).max(1),
})

export type SingleUpsertInput = z.infer<typeof SingleUpsertSchema>

// ---------------------------------------------------------------------------
// Batch upsert request body (max 50 items per request — FR-028)
// ---------------------------------------------------------------------------

export const BatchUpsertSchema = z.object({
  items: z
    .array(TranslationUpsertItemSchema)
    .min(1, 'items array must not be empty')
    .max(50, 'Batch upsert is limited to 50 items per request'),
})

export type BatchUpsertInput = z.infer<typeof BatchUpsertSchema>

// ---------------------------------------------------------------------------
// GET /translations query schema
// ---------------------------------------------------------------------------

export const GetTranslationsQuerySchema = z.object({
  entity_type: z.string().min(1).max(64),
  entity_id: uuidSchema,
  cursor: z.string().optional(),
  page_size: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v !== undefined ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(50).optional()),
})

export type GetTranslationsQuery = z.infer<typeof GetTranslationsQuerySchema>

// ---------------------------------------------------------------------------
// GET /translations/coverage query schema
// ---------------------------------------------------------------------------

export const GetCoverageQuerySchema = z.object({
  entity_type: z.string().min(1).max(64),
  language_code: languageCodeSchema,
})

export type GetCoverageQuery = z.infer<typeof GetCoverageQuerySchema>
