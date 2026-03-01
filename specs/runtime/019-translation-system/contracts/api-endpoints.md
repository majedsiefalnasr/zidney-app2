# API Endpoint Contracts: Translation System

**Feature Branch**: `019-translation-system`
**Date**: 2026-03-01
**Stage**: Phase 1 Design

---

## POST /api/workspaces/:slug/translations

**Purpose**: Upsert one or many translations for entity fields

### Request (Single)

```json
{
  "entity_type": "subject",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "field_name": "title",
  "language_code": "fr",
  "translated_value": "Titre en français"
}
```

### Request (Batch)

```json
{
  "translations": [
    {
      "entity_type": "subject",
      "entity_id": "550e8400-e29b-41d4-a716-446655440000",
      "field_name": "title",
      "language_code": "fr",
      "translated_value": "Titre en français"
    },
    {
      "entity_type": "subject",
      "entity_id": "550e8400-e29b-41d4-a716-446655440000",
      "field_name": "description",
      "language_code": "fr",
      "translated_value": "Description en français"
    }
  ]
}
```

Constraints: max 50 items per batch.

### Request Validation (Zod)

```typescript
const TranslationUpsertItemSchema = z.object({
  entity_type: z.string().min(1).max(100),
  entity_id: z.string().uuid(),
  field_name: z.string().min(1).max(100),
  language_code: z.string().min(2).max(10),
  translated_value: z.string(), // empty string '' is valid; null is not
})

const SingleUpsertSchema = TranslationUpsertItemSchema

const BatchUpsertSchema = z.object({
  translations: z.array(TranslationUpsertItemSchema).min(1).max(50),
})
```

### Response: Success (HTTP 200)

```json
{
  "success": true,
  "data": {
    "saved": [
      {
        "id": "uuid",
        "entity_type": "subject",
        "entity_id": "uuid",
        "field_name": "title",
        "language_code": "fr",
        "translated_value": "Titre en français",
        "created_at": "2026-03-01T12:00:00.000Z",
        "updated_at": "2026-03-01T12:00:00.000Z"
      }
    ],
    "count": 1
  },
  "error": null
}
```

HTTP 200 is returned for both create and update (idempotent — no 201).

### Response: Errors

```json
// 422 — language not supported
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNSUPPORTED_LANGUAGE",
    "message": "Language 'es' is not in the workspace supported languages."
  }
}

// 422 — attempting to write default language
{
  "success": false,
  "data": null,
  "error": {
    "code": "DEFAULT_LANGUAGE_WRITE",
    "message": "Cannot store translations for the workspace default language 'ar'. Default language content lives in base entity tables."
  }
}

// 404 — entity does not exist
{
  "success": false,
  "data": null,
  "error": {
    "code": "ENTITY_NOT_FOUND",
    "message": "Entity of type 'subject' with id 'uuid' was not found."
  }
}

// 422 — invalid field name
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_FIELD_NAME",
    "message": "Field 'summary' is not a translatable field for entity type 'subject'."
  }
}

// 422 — batch validation failed
{
  "success": false,
  "data": null,
  "error": {
    "code": "BATCH_VALIDATION_FAILED",
    "message": "Batch validation failed: item at index 2 has an invalid language_code."
  }
}
```

---

## GET /api/workspaces/:slug/translations

**Purpose**: Resolve entity translations with fallback (Mode A) OR list translation management panel rows (Mode B)

### Mode A: Resolution (language_code present)

**Query parameters**:

- `entity_type` (required): string
- `entity_id` (required): UUID
- `language_code` (required): ISO 639-1 code

**Response: Success (HTTP 200)**

```json
{
  "success": true,
  "data": {
    "entity_type": "subject",
    "entity_id": "uuid",
    "language_code": "fr",
    "fields": {
      "title": "Titre en français",
      "description": "Description de base (fallback)"
    },
    "fallback_fields": ["description"]
  },
  "error": null
}
```

`fallback_fields` lists field names that fell back to the default-language base entity value.

### Mode B: Management Panel List (language_code absent)

**Query parameters**:

- `entity_type` (required): string
- `entity_id` (required): UUID
- `cursor` (optional): pagination cursor string
- `page_size` (optional): 1–50, default 20

**Response: Success (HTTP 200)**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "entity_type": "subject",
        "entity_id": "uuid",
        "field_name": "title",
        "language_code": "fr",
        "translated_value": "Titre en français",
        "created_at": "2026-03-01T12:00:00.000Z",
        "updated_at": "2026-03-01T12:00:00.000Z"
      }
    ],
    "next_cursor": "cursor-string-or-null",
    "page_size": 20
  },
  "error": null
}
```

---

## GET /api/workspaces/:slug/translations/coverage

**Purpose**: Return translation coverage percentage per entity type and language

### Query parameters

- `entity_type` (required): string
- `language_code` (optional): if present, return coverage for that language only

### Response: Success (HTTP 200)

```json
{
  "success": true,
  "data": {
    "coverage": [
      {
        "entity_type": "subject",
        "language_code": "fr",
        "translated_count": 15,
        "total_possible": 30,
        "coverage_percent": 50.0
      },
      {
        "entity_type": "subject",
        "language_code": "en",
        "translated_count": 28,
        "total_possible": 30,
        "coverage_percent": 93.33
      }
    ]
  },
  "error": null
}
```

Notes:

- Default language is never included in coverage results (FR-020)
- Languages with `language_status='removing'` are not included
- Empty array when no non-default languages are configured

---

## Common Error Response Shape

All errors conform to the platform standard:

```typescript
interface ErrorResponse {
  success: false
  data: null
  error: {
    code: string // One of TranslationErrorCode constants
    message: string
  }
}
```

## Common Success Response Shape

```typescript
interface SuccessResponse<T> {
  success: true
  data: T
  error: null
}
```
