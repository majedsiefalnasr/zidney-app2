# Accessibility Checklist: Category Values

**Purpose**: Validate accessibility requirement quality — translation coverage, multi-language support, RTL layout, error message clarity, and API usability for diverse audiences are sufficiently specified
**Created**: 2026-03-22
**Feature**: [spec.md](../spec.md)
**Stage**: `STAGE_31_CATEGORY_VALUES`

---

## Translation Coverage Requirements

- [ ] CHK001 — Are translation requirements defined for ALL user-visible text fields (`name` and `description`) with explicit storage in the `translations` table, ensuring no display text is hard-coded in the `category_values` row? [Completeness, Spec §Translation Records for Category Values]
- [ ] CHK002 — Is the minimum translation requirement (at least one `name` for the workspace default language) expressed as an enforceable validation rule (422 `CATEGORY_VALUE_NAME_REQUIRED`) rather than a documentation note? [Clarity, Spec §Validation Rules]
- [ ] CHK003 — Is the translation fallback chain (requested language → workspace default language → empty string, never null) specified as a deterministic algorithm implementable without ambiguity? [Clarity, Spec §BR-10]
- [ ] CHK004 — Is the `description` field specified as optional in translations (nullable) with a documented fallback of `null` (not empty string) to distinguish "no description" from "missing translation"? [Clarity, Spec §Translation Records for Category Values, Spec §US-07]
- [ ] CHK005 — Are translation upsert semantics (replace existing row for the same language, do not duplicate, leave other languages unchanged) defined precisely enough to be tested as a contract? [Completeness, Spec §BR-09]
- [ ] CHK006 — Is the `language` query parameter on GET endpoints defined to accept a workspace-configured language code, with a documented fallback to workspace default when omitted? [Completeness, Spec §GET /category-values, Spec §GET /category-values/:id]

## Multi-Language & RTL Requirements

- [ ] CHK007 — Is RTL text support for Arabic content (`language_code: "ar"`) explicitly required, or is it implicitly assumed as part of the platform's translation infrastructure? [Gap]
- [ ] CHK008 — Are requirements defined for the presence of both `ar` and `en` translations in the same response, ensuring bidirectional character content is correctly returned without corruption? [Gap]
- [ ] CHK009 — Is the workspace default language propagation requirement (API reads `c.get('tenant').languages` at runtime) documented as a hard requirement, not an assumed implementation detail? [Clarity, Spec §US-07 scenario 4, Spec §Assumptions — Assumption 2]
- [ ] CHK010 — Is there a requirement specifying how the API behaves when the workspace has only one configured language (e.g., Arabic-only workspace) and a request arrives with `language=en`? [Gap]
- [ ] CHK011 — Are bilingual list responses (returning translated `name` in the requested language alongside the `code`) required to handle RTL names without truncation or encoding issues? [Gap]

## Error Message Accessibility Requirements

- [ ] CHK012 — Are error `code` values (e.g., `CATEGORY_VALUE_NOT_FOUND`, `INVALID_STATUS_TRANSITION`) required to be stable, machine-readable identifiers, with the `message` field carrying human-readable text? [Clarity, Spec §Error Contract]
- [ ] CHK013 — Is there a requirement that `message` fields in error responses are meaningful in isolation (not requiring knowledge of internal state) to support accessibility for screen-reader-driven UI? [Gap]
- [ ] CHK014 — Is there a requirement for error messages to be returneable in the request's preferred language, or are error messages English-only by platform convention? [Gap]
- [ ] CHK015 — Is the 422 `CATEGORY_VALUE_NAME_REQUIRED` error message specific enough that a caller can understand which translation field is missing and in which language? [Clarity, Spec §API Contracts — POST error table]
- [ ] CHK016 — Are error messages for scope violations (422 `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT`) required to identify which `subject_id` or `division_id` exceeded the parent scope, or is a generic error acceptable? [Clarity, Spec §API Contracts]

## API Usability & Consistency Requirements

- [ ] CHK017 — Are query parameter names on category-value endpoints consistent with equivalent parameters on other classification endpoints (categories, subjects, divisions) in the platform? [Consistency]
- [ ] CHK018 — Is the `language` query parameter behavior on category-value GET endpoints consistent with other translation-aware endpoints in the Backoffice API? [Consistency, Spec §GET /category-values]
- [ ] CHK019 — Are response field names (`category_id`, `subject_ids`, `division_ids`, `created_at`, `updated_at`) consistent with platform-wide API naming conventions (snake_case) and not mixed with camelCase? [Consistency, Spec §API Contracts]
- [ ] CHK020 — Is the `include_deleted` query parameter naming convention consistent with soft-delete filter parameters on other endpoints (e.g., categories), or does it introduce a per-endpoint naming inconsistency? [Consistency]
- [ ] CHK021 — Is there a requirement that the `translations` array in all responses preserves language ordering consistently (e.g., default language first), making it predictable for UI consumers? [Gap]
- [ ] CHK022 — Is the soft-delete model (returning 404 for deleted resources rather than a distinct `410 Gone`) documented as the deliberate convention, ensuring UI consumers know to handle deleted IDs as "not found"? [Completeness, Spec §US-03 scenario 4]

## Notes

- CHK001–CHK006: Must-have category for translation coverage — the spec's translation contract must be clear and complete.
- CHK009: Must-have. Workspace default language propagation is a runtime requirement; spec references `c.get('tenant').languages` (Assumption 2) but does not formally state it as a requirement.
- CHK007–CHK011: Gap items — RTL and bidirectional text requirements are not explicitly specified; the platform may have a global RTL standard, but this spec does not reference it.
- CHK014: Gap item — language-aware error messages are not addressed. Clarify if error messages are always English per platform convention.
- CHK017–CHK022: Consistency items — validate that this endpoint does not diverge from established API conventions in the Backoffice namespace.
