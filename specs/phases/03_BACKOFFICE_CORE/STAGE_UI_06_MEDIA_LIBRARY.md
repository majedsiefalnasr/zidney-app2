---
# STAGE_UI_06_MEDIA_LIBRARY

Phase: 03_BACKOFFICE_CORE
Track: UI (apps/backoffice)

Backend Dependency:
  - STAGE_47_MEDIA_LIBRARY

UI Dependencies:
  - STAGE_UI_01_BACKOFFICE_SHELL
  - STAGE_UI_02_ACADEMIC_STRUCTURE
---

## Purpose

This stage implements the Backoffice Media Library UI, enabling institutions to:

- Upload media assets (images, PDFs, audio, video if supported)
- Organize assets
- Search and filter assets
- Assign media to questions, lessons, and content modules
- Manage asset lifecycle (archive/delete if permitted)

UI must strictly consume backend APIs.

No file storage logic, signing logic, or storage path logic may exist in UI.

---

## Architectural Constraints

Media Library UI must:

- Be tenant-scoped only
- Never access master database
- Never generate storage paths
- Never expose raw storage credentials
- Use centralized API client (Phase 06)
- Use signed upload URLs if provided by backend

Backend remains authoritative for:

- Storage provider integration (S3, etc.)
- Signed upload URL generation
- File size limits
- File type validation
- Virus scanning (if implemented)
- Media metadata persistence

---

## Module Breakdown

### 1️⃣ Asset Upload

UI must support:

- Drag & drop upload
- Manual file selection
- Progress indicator
- Upload cancellation (if backend supports)

Upload Flow (Recommended):

1. Request signed upload URL from backend
2. Upload file directly to storage
3. Confirm upload completion with backend
4. Persist metadata

Constraints:

- No file binary passes through UI API server unless explicitly required
- File size limit must be enforced client-side (basic check)
- File type validated client-side (basic check)
- Server remains final authority

If upload fails:

- Show clear error
- Allow retry
- Do not auto-retry endlessly

---

### 2️⃣ Asset Listing

UI must support:

- Grid view
- List view
- Pagination (server-side)
- Filtering by type
- Sorting (created_at, size, name)
- Search by filename

Must not:

- Load entire dataset
- Cache sensitive metadata globally

---

### 3️⃣ Asset Preview

UI may support:

- Image preview
- PDF preview (if supported)
- Video thumbnail
- File metadata display

Security:

- Use secure, time-limited URLs
- Do not expose raw bucket path
- Do not embed permanent public URLs

---

### 4️⃣ Asset Usage Tracking

UI must show:

- Where asset is used (if backend provides)
- Usage count
- Warning before deletion if referenced

Deletion must:

- Be blocked if asset in use
- Respect backend 409 conflict

No silent cascading delete.

---

### 5️⃣ Asset Organization

If backend supports:

- Tags
- Folders
- Categories

UI must:

- Reflect structure exactly
- Not implement independent folder logic
- Not allow client-side-only organization

All structure persisted server-side.

---

## Validation Rules

Client-side validation:

- File size limit (pre-check)
- File type restriction
- Filename sanitization

Server-side validation:

- MIME type validation
- Virus scan validation
- Storage quota enforcement
- Tenant storage limit enforcement

UI must display detailed validation errors.

---

## License Limit Awareness

If media usage is limited by license:

UI must:

- Display storage usage
- Show warning when near limit
- Block upload if backend returns LIMIT_EXCEEDED

No client-side storage calculation.

---

## Security Requirements

Must prevent:

- XSS via malicious file name
- SVG script injection
- Arbitrary file type upload
- Path traversal attacks
- Cross-tenant file access
- Exposure of signed URLs beyond TTL

All previews must sanitize metadata.

---

## Observability Requirements

UI must log:

- media_upload_attempt
- media_upload_success
- media_upload_failure
- media_delete_attempt
- media_delete_success
- media_delete_blocked

Must include:

- workspace_slug
- media_id
- correlation_id

No file binary data logged.

---

## Performance Requirements

Media libraries may grow large.

UI must:

- Use pagination
- Lazy-load thumbnails
- Debounce search input
- Avoid heavy re-render loops
- Cache small metadata only per session

Initial load must remain performant.

---

## Concurrency Handling

If asset deleted while open:

- Backend returns 404
- UI must handle gracefully
- Remove asset from list
- Show notification

If conflict:

- Refresh state
- Show clear message

No optimistic deletion without backend confirmation.

---

## E2E Validation Scenarios

Mandatory tests:

1. Upload valid image
2. Upload invalid file type
3. Upload exceeding size limit
4. List assets with pagination
5. Search assets
6. Preview asset
7. Attempt delete in-use asset
8. Delete unused asset
9. Simulate storage limit exceeded
10. Cross-tenant isolation test

All must pass before stage closure.

---

## Completion Criteria

Stage complete when:

- Upload functional
- Listing performant
- Preview secure
- Deletion safe
- License limits respected
- No console errors
- E2E scenarios pass

---

## Governance Rule

Backoffice Media Library UI must never:

- Expose storage credentials
- Persist file paths locally
- Bypass storage quota enforcement
- Perform file validation as final authority

All storage authority remains backend-controlled.

---
