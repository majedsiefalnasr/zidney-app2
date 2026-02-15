# STAGE 47 – Media Library

Phase: 3 – Backoffice Core  
Domain: Media & Assets  
Status: Critical Infrastructure Component

---

## 1. Objective

Provide a centralized, secure, and workspace-isolated media management system that:

- Stores and organizes files per tenant
- Prevents unsafe deletion
- Tracks usage references
- Enforces validation and limits
- Supports structured search & filtering
- Enables safe integration with exams, library, ads, lives, and certificates

Media must be fully tenant-isolated.

No file may ever be accessible across workspaces.

---

## 2. Storage Architecture

Each workspace must have isolated storage namespace:

Option A (Recommended):

- Single object storage bucket
- Prefix per workspace:
  workspace/<slug>/

Option B:

- Separate bucket per workspace (higher isolation, higher cost)

For VPS-first architecture:

- Local storage path:
  /data/media/workspace\_<slug>/

Must be abstracted via storage service layer.

No direct filesystem access from domain services.

---

## 3. Core Entities

media_files

Required fields:

- id (UUID)
- workspace_id
- original_name
- stored_name
- storage_path
- mime_type
- file_size_bytes
- file_extension
- folder_id (nullable)
- is_used (boolean)
- usage_count (integer)
- checksum_hash
- uploaded_by
- created_at
- updated_at

media_folders

- id
- workspace_id
- name
- parent_id (nullable)
- created_at
- updated_at

media_tags

- id
- workspace_id
- name
- created_at

media_file_tags (pivot)

- media_id
- tag_id

All tables must include workspace_id.

---

## 4. File Upload Rules

Validation required:

- Allowed mime types whitelist
- Max file size (configurable per workspace)
- Virus scanning hook (future-ready)
- Filename sanitization
- Prevent executable uploads (.exe, .sh, .bat, etc.)
- Reject double extension tricks

Checksum (SHA256) must be computed.

Duplicate detection optional but recommended.

Uploads must be transactional:

1. Store file
2. Insert DB record
3. Commit
4. If DB fails → delete file

No orphan files allowed.

---

## 5. Folder Structure

- Nested folder hierarchy supported
- Max depth limit enforced (recommended: 5)
- Prevent circular parent references
- Deleting folder requires:
  - Folder empty
  - Or recursive delete confirmation (optional future)

---

## 6. Usage Tracking

Media usage must be tracked automatically.

When media is attached to:

- MCQ question
- Traditional question
- Exam template
- Library file
- Certificate template
- Ads
- Live session materials

System must:

- Increment usage_count
- Set is_used = true

When detached:

- Decrement usage_count
- If usage_count = 0 → is_used = false

Deletion rule:

- Cannot delete media if usage_count > 0
- Must return 409 Conflict

No silent forced deletion allowed.

---

## 7. Search & Filtering

Must support:

- Search by original_name
- Filter by mime_type
- Filter by folder
- Filter by tags
- Filter by file size range
- Sort by date / size / name

Indexing required on:

- workspace_id
- mime_type
- created_at
- folder_id

---

## 8. Security Model

Strict rules:

- Media access always scoped by workspace
- Access requires authentication
- Signed URL generation recommended (future-ready)
- No direct public exposure of storage path
- No predictable filename access

Download flow:

1. Authenticated request
2. Validate workspace ownership
3. Stream file securely

---

## 9. Performance Considerations

- File metadata in DB
- Files stored in storage layer
- No base64 storage in DB
- No binary storage in Postgres
- Streaming for large files
- Limit concurrent uploads (rate limiting stage integration)

---

## 10. Audit Logging

Every media operation must log:

- workspace_slug
- media_id
- user_id
- action (UPLOAD | DELETE | MOVE | TAG | UNTAG)
- timestamp

Logs must be structured.

---

## 11. Validation Criteria

Stage complete when:

- Upload works with validation
- File stored correctly
- Metadata persisted
- Usage tracking works
- Prevent deletion when used
- Folder hierarchy works
- Search & filter works
- Cross-workspace access blocked
- Storage abstraction implemented
- Logs include workspace_slug

---

## 12. Not Allowed

- Storing binary inside DB
- Cross-tenant media sharing
- Deleting used media silently
- Hardcoded storage path in services
- Public direct storage access

---

## Stability Principle

Media integrity impacts:

- Exams
- Certificates
- Ads
- Library
- Branding

If media tracking breaks,
content integrity breaks.

This stage must be stable before:

STAGE_48_NOTIFICATIONS_ENGINE
