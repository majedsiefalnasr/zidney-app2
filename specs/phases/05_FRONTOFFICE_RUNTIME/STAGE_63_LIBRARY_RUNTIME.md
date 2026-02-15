# STAGE 63 – Library Runtime

Phase: 05_FRONTOFFICE_RUNTIME  
Status: Critical  
Scope: Frontoffice library access, filtering, authorization, and secure file delivery

---

## Objective

Define the runtime behavior of the Frontoffice Library module, including:

- Library content visibility rules
- Division-based scoping
- Subscription enforcement
- Package/module enforcement
- Secure file delivery
- Download tracking
- Featured and recent aggregation

The Library must behave as a controlled academic resource system, not a public file browser.

---

## Runtime Visibility Rules

Library files must only be visible if all conditions are satisfied:

1. License status = ACTIVE
2. User authenticated (STUDENT role)
3. Subscription valid
4. Library module enabled in product
5. Package includes Library access
6. Division access matches
7. File status = ENABLED

All visibility checks must occur server-side.

No filtering logic may be trusted from frontend.

---

## Division Scoping

Each library file may:

- Be global (no division restriction), or
- Be restricted to specific divisions

Student must only see files where:

- file.division_id IS NULL  
  OR
- file.division_id = student.division_id

Division filtering must be applied at query level.

---

## Subject & Academic Filtering

Library files may be associated with:

- Subject
- Semester
- Category
- Category values
- Tags

Runtime filtering must support:

- Subject filter
- Semester filter
- Category filter
- Category value filter
- Tag filter
- Text search (file name + description)

Filtering must be composable and safe.

---

## Subscription Enforcement

If subscription expired:

- User may log in
- User may access profile
- User may view certificates
- User may NOT access library content

Library endpoints must check subscription status before returning data.

Return 403 if subscription invalid.

---

## Package Enforcement

Each subscription package defines included modules.

If Library module not included:

- Hide Library menu
- Reject Library API calls with 403

No partial file access allowed.

---

## File Status Workflow

Each file has status:

- COMPLETED
- UNDER_REVIEW
- APPROVED
- ENABLED

Only ENABLED files are visible in Frontoffice.

Files in other statuses must never be exposed.

---

## Featured and Popular Logic

Library runtime must support:

Featured files:

- file.featured = true

Recent files:

- order by created_at DESC

Popular files:

- order by download_count DESC

Download count increments only after successful authorized download.

---

## Secure File Delivery

Direct file URLs must never be exposed.

Files must be delivered through:

Signed access flow:

1. Client requests download
2. Server validates:
   - Subscription
   - Package
   - Division
   - File status
3. Server generates:
   - Short-lived signed URL OR
   - Streams file via backend

Signed URL must:

- Expire quickly
- Be single-use (recommended)

Media storage may be:

- Local filesystem
- Object storage (S3-compatible)
- External CDN (future)

Access must always go through permission layer.

---

## Download Tracking

On successful download:

- Insert row in library_downloads table
- Increment file.download_count

Download record must include:

- user_id
- file_id
- timestamp
- workspace_id

Download logging must not block file delivery.

If logging fails, file delivery should still succeed.

---

## Library File Model (Runtime Relevant Fields)

Required fields:

- id
- name
- description
- subject_id
- semester_id
- division_id (nullable)
- category_id
- file_type_id
- file_format_id
- file_path
- status
- featured
- download_count
- created_at

No internal storage path exposed to frontend.

---

## Search Behavior

Search must:

- Be case-insensitive
- Match partial terms
- Search name and description
- Respect all visibility rules

Search must not bypass division or subscription checks.

---

## Performance Requirements

Expected university scale:

- Thousands of files
- Hundreds of concurrent searches

Indexes required on:

- division_id
- subject_id
- status
- featured
- created_at

Search must be optimized via indexed queries.

---

## Observability

Each library request must log:

- workspace_slug
- user_id
- request_id
- filter parameters
- result count

Download event must log:

- file_id
- user_id
- success or failure
- reason if rejected

---

## Failure Cases

If license not ACTIVE:
→ 423 or 403

If subscription expired:
→ 403

If file not found:
→ 404

If division mismatch:
→ 403

If package does not include Library:
→ 403

All errors must follow platform error standard.

---

## Forbidden

- Public file URLs
- Direct storage path exposure
- Frontend-only filtering
- Access without subscription check
- Ignoring division scoping
- Returning disabled files
- Hardcoded file paths

---

## Completion Criteria

Stage complete when:

- Library list respects all filters
- Subscription enforcement verified
- Division scoping verified
- Package enforcement verified
- Secure download flow implemented
- Download tracking functional
- Featured and recent sections working
- Logs include required fields
- No file accessible without permission

Library must be secure before moving to:

STAGE_64_LIVE_SESSION_RUNTIME
