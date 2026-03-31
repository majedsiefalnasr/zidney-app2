# Accessibility Requirements Quality Checklist: MCQ Question Model

**Purpose**: Validate completeness, clarity, and consistency of accessibility requirements in the MCQ Question Model spec
**Created**: 2026-03-30
**Feature**: [spec.md](../spec.md)
**Stage**: `STAGE_34_MCQ_QUESTION_MODEL`

## Rich Text Content Accessibility

- [ ] CHK001 - Are accessibility requirements defined for rich text question content (alt text for images, semantic HTML structure)? [Gap, Spec §Data Model content field]
- [ ] CHK002 - Are accessibility requirements defined for rich text option content (screen reader compatibility, meaningful text alternatives)? [Gap]
- [ ] CHK003 - Is the HTML whitelist for sanitization evaluated against accessibility needs (are semantic elements like `<strong>`, `<em>`, `<table>`, `<ul>`, `<ol>` preserved)? [Gap, Spec §Rich text content sanitization]
- [ ] CHK004 - Are requirements defined for ensuring sanitized HTML output remains semantically valid and accessible? [Gap, Consistency]
- [ ] CHK005 - Are requirements defined for handling mathematical notation or special characters in question content accessibly? [Gap, Edge Case]
- [ ] CHK006 - Is it specified whether rich text content must include language attributes for multilingual accessibility? [Gap, Spec §Data Model language field]

## API Response Accessibility

- [ ] CHK007 - Are error messages specified to be human-readable and descriptive enough for assistive technology users (not just error codes)? [Clarity, Spec §API Endpoints error shape]
- [ ] CHK008 - Are error response requirements consistent in providing both machine-readable codes AND human-readable messages across all endpoints? [Consistency, Spec §Error response shape]
- [ ] CHK009 - Are localization requirements defined for error messages (Arabic/English based on tenant or user locale)? [Gap, Non-Functional]
- [ ] CHK010 - Are requirements defined for the ordering of options in API responses to support consistent screen reader navigation? [Gap, Coverage]

## Question Type Accessibility

- [ ] CHK011 - Are accessibility requirements defined for how ARRANGEMENT-type questions communicate ordering semantics to assistive technologies? [Gap, Spec §ARRANGEMENT type]
- [ ] CHK012 - Are accessibility requirements defined for distinguishing SINGLE vs. MULTIPLE selection modes (radio vs. checkbox semantics)? [Gap, Spec §Question Types table]
- [ ] CHK013 - Are requirements defined for communicating TRUE_FALSE question constraints to content authors (exactly 2 options) in an accessible authoring interface? [Gap, Edge Case]
- [ ] CHK014 - Is the `is_correct` field's meaning for ARRANGEMENT type (ignored) documented clearly enough for content authors using assistive technology? [Clarity, Spec §ARRANGEMENT type]

## Content Authoring Accessibility (Backoffice)

- [ ] CHK015 - Are accessibility requirements defined for the question creation form (keyboard navigation, focus management, field labeling)? [Gap, Non-Functional]
- [ ] CHK016 - Are accessibility requirements defined for the option management interface (add, reorder, remove options)? [Gap, Non-Functional]
- [ ] CHK017 - Are accessibility requirements defined for the workflow transition interface (status progression, transition feedback)? [Gap, Non-Functional]
- [ ] CHK018 - Are accessibility requirements defined for the classification linking interface (category, tag, basket assignment)? [Gap, Non-Functional]
- [ ] CHK019 - Are accessibility requirements defined for the question list/filter interface (filter controls, pagination, result navigation)? [Gap, Non-Functional]
- [ ] CHK020 - Are requirements defined for announcing validation errors accessibly (which field failed, what rule was violated)? [Gap, Coverage]

## Multilingual & RTL Accessibility

- [ ] CHK021 - Is the `language` field requirement sufficient to support RTL (Arabic) and LTR (English) content rendering? [Clarity, Spec §Data Model language field]
- [ ] CHK022 - Are requirements defined for mixed-direction content (e.g., Arabic question with English technical terms)? [Gap, Edge Case]
- [ ] CHK023 - Are accessibility requirements defined for screen reader pronunciation of mixed-language content? [Gap, Non-Functional]
- [ ] CHK024 - Is the `language` field used to set appropriate `lang` attributes for assistive technology? [Gap, Coverage]

## Deletion & State Change Accessibility

- [ ] CHK025 - Are requirements defined for how soft-deleted question exclusion is communicated (not silently hidden but properly conveyed in empty states)? [Gap, Edge Case]
- [ ] CHK026 - Are requirements defined for accessible confirmation dialogs before destructive operations (delete, hard delete)? [Gap, Non-Functional]
- [ ] CHK027 - Are requirements defined for accessible feedback when workflow transitions succeed or fail? [Gap, Coverage]
- [ ] CHK028 - Are requirements defined for accessible communication of optimistic concurrency conflicts (409 Conflict) to the content author? [Gap, Spec §PATCH mcq-questions]

## Data Format Accessibility

- [ ] CHK029 - Are ISO 8601 timestamp requirements sufficient for accessible date/time display (timezone, locale formatting)? [Clarity, Spec §Response schemas]
- [ ] CHK030 - Are pagination metadata requirements (total, page, perPage) sufficient for assistive technology to convey result set context? [Clarity, Spec §GET mcq-questions response]
- [ ] CHK031 - Are requirements defined for accessible handling of truncated content in list responses vs. full content in detail responses? [Gap, Coverage]

## Constitutional Compliance & Accessibility Intersection

- [ ] CHK032 - Are tenant isolation error states (wrong tenant, no access) communicated accessibly without leaking tenant information? [Gap, Constitutional Rule]
- [ ] CHK033 - Are license enforcement error states (423 SOFT_LOCKED, 403 ARCHIVED) accompanied by accessible, human-readable explanations? [Gap, Constitutional Rule]
- [ ] CHK034 - Are rate limit exceeded responses specified with accessible messaging (retry-after guidance)? [Gap, Constitutional Rule]
- [ ] CHK035 - Are schema version mismatch errors (409) specified with accessible guidance for the user? [Gap, Constitutional Rule]

## Notes

- This spec is primarily an API/data model specification; frontend accessibility requirements are largely gaps because the spec correctly scopes Backoffice UI out of this stage. However, the data model and API response design choices impact downstream accessibility.
- Constitutional rules validated: tenant isolation (error state communication), license middleware (accessible error responses), idempotency (409 Conflict accessible messaging)
- Total items: 35
- Traceability: 33/35 items (94.3%) include spec section or gap markers
