# Worker Job Schema: Translation System

**Feature Branch**: `019-translation-system` **Date**: 2026-03-01 **Stage**: Phase 1 Design

---

## DRAIN_LANGUAGE_TRANSLATIONS Job

**Registered in**: `packages/types/job-envelope.ts` (add to job union) **Handler**:
`apps/worker/src/jobs/drain-language-translations.ts` **Queue**: Standard worker job queue (same as
existing jobs)

### Trigger Conditions

Enqueued by the language removal endpoint (`PATCH /api/workspaces/:slug/settings/language`) when:

- A language is being removed from `supported_languages`
- `COUNT(*) FROM translations WHERE language_code = X` exceeds 10,000

Below the threshold, deletion is synchronous and this job is NOT enqueued.

### Job Payload Schema

```typescript
interface DrainLanguageTranslationsJob {
  /** Job type discriminator — must be exactly this string */
  job_type: "DRAIN_LANGUAGE_TRANSLATIONS";

  /** Tenant workspace identifier (UUID) */
  workspace_id: string;

  /** Tenant workspace slug — used to resolve tenant DB connection */
  workspace_slug: string;

  /** ISO 639-1 language code being drained (e.g. 'fr', 'es') */
  language_code: string;

  /**
   * Rows to delete per batch iteration.
   * Default: 1000. Configurable by operator at enqueue time.
   * Minimum: 100. Maximum: 5000.
   */
  batch_size: number;

  /** Correlation ID from the HTTP request that triggered the removal */
  correlation_id: string;

  /** User ID of the staff member who initiated the language removal */
  initiated_by_user_id: string;

  /** Retry attempt number — incremented by worker infrastructure on retry */
  attempt?: number;

  /** ISO8601 timestamp when job was created (set at enqueue time) */
  created_at: string;
}
```

### JSON Example

```json
{
  "job_type": "DRAIN_LANGUAGE_TRANSLATIONS",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "workspace_slug": "acme-university",
  "language_code": "fr",
  "batch_size": 1000,
  "correlation_id": "req_01HXYZ...",
  "initiated_by_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "attempt": 1,
  "created_at": "2026-03-01T12:00:00.000Z"
}
```

### Execution Contract

| Property           | Value                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Idempotent         | Yes — safe to re-run; only drains rows that still exist                                                                                                                                                                                                      |
| Retry-safe         | Yes — retries continue from remaining rows                                                                                                                                                                                                                   |
| Transaction scope  | One transaction per batch (not one mega-transaction)                                                                                                                                                                                                         |
| Audit requirement  | Audit log entry per deleted translation row (action='deleted', reason='language_removed'). **The batch DELETE MUST use `RETURNING id, entity_type, entity_id, field_name, language_code` so all FR-032 required fields are available for each audit entry.** |
| Post-drain cleanup | Remove `language_status[language_code]` key from `workspace_settings`                                                                                                                                                                                        |
| Cache invalidation | Call `CoverageService.invalidateWorkspaceCoverage(workspace_id)` after drain complete                                                                                                                                                                        |
| Completion signal  | `language_settings.language_status[language_code]` key absent from workspace_settings                                                                                                                                                                        |

### Structured Log Events

```typescript
// Per batch
{
  event: 'drain_batch',
  job_type: 'DRAIN_LANGUAGE_TRANSLATIONS',
  workspace_id: string,
  workspace_slug: string,
  language_code: string,
  batch_deleted: number,
  total_deleted: number,
  correlation_id: string,
  batch_size: number,
}

// On drain complete
{
  event: 'drain_complete',
  job_type: 'DRAIN_LANGUAGE_TRANSLATIONS',
  workspace_id: string,
  workspace_slug: string,
  language_code: string,
  total_deleted: number,
  correlation_id: string,
}

// On job failure
{
  event: 'drain_failed',
  job_type: 'DRAIN_LANGUAGE_TRANSLATIONS',
  workspace_id: string,
  workspace_slug: string,
  language_code: string,
  error: string,
  attempt: number,
  correlation_id: string,
}
```

### Concurrency Safety

Only one `DRAIN_LANGUAGE_TRANSLATIONS` job per `(workspace_id, language_code)` should be active at a
time.

Guards:

1. `language_status[language_code] = 'removing'` in workspace_settings — the language removal
   endpoint rejects new removal requests for languages already in `'removing'` state (returns 409).
2. Job deduplication via `job-hash.ts` (existing worker infrastructure) — the hash key is
   `{workspace_id}:{language_code}:drain`.

### State Lifecycle

```
Normal state:
  language in supported_languages, language_status key absent (= 'active')

Language removal triggered (>10,000 rows):
  language removed from supported_languages
  language_status['fr'] = 'removing'
  DRAIN_LANGUAGE_TRANSLATIONS job enqueued

Worker draining:
  language_status['fr'] = 'removing' (unchanged while draining)
  Batch delete loop running

Drain complete:
  language_status['fr'] key deleted from workspace_settings
  All translation rows for language_code='fr' are deleted
  Coverage cache invalidated
```

### API Response When Job Is Enqueued

The language removal endpoint returns HTTP 409 (not 202) to signal the caller that the language was
removed from settings but translation row cleanup is async:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LANGUAGE_REMOVAL_REQUIRES_ASYNC",
    "message": "Language 'fr' has been removed from supported languages. Translation row cleanup (120,450 rows) is being processed asynchronously. Poll workspace settings to confirm completion."
  }
}
```

The language is immediately removed from `supported_languages` in workspace_settings — no new
translations can be saved in that language once the 409 is returned. The drain job only purges the
existing rows.
