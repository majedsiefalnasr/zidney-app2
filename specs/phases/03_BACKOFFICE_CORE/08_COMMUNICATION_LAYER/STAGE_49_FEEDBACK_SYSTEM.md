# STAGE 49 – Feedback System

Phase: 3 – Backoffice Core  
Domain: Communication Layer  
Status: Mandatory  
Scope: Structured collection, storage, categorization, and analysis of user feedback within a
workspace

---

## Stage Status

Status: DRAFT

---

## Objective

Implement a structured feedback system that:

- Collects feedback from students (Frontoffice)
- Categorizes feedback by module and type
- Links feedback to attempts when applicable
- Enables filtering, exporting, and analytics in Backoffice
- Maintains strict tenant isolation
- Preserves audit integrity

This system is workspace-scoped. No cross-workspace feedback aggregation.

---

## Feedback Sources

Feedback can originate from:

1. After exam submission (MCQ, Topics, Exercises, Scheduled)
2. General platform feedback page (Frontoffice)
3. Optional contextual prompts (future enhancement)

Each feedback record must store its origin.

---

## Feedback Types

Each workspace manages its own feedback types.

feedback_types table:

- id
- name (multi-language)
- module_scope (MCQ | EXAM | LIBRARY | LIVES | GENERAL)
- enabled (boolean)
- created_at
- updated_at

Feedback types are configurable per workspace.

---

## Feedback Table

feedback table (tenant DB):

- id
- user_id (student)
- module (MCQ | EXAM | LIBRARY | LIVES | GENERAL)
- related_entity_id (nullable)
- related_entity_type (ATTEMPT | EXAM | TOPIC | FILE | SESSION | NULL)
- attempt_id (nullable)
- rating (1–5 nullable)
- feedback_type_id (nullable)
- message (text)
- metadata (jsonb nullable)
- created_at

Rules:

- Feedback cannot be edited after submission
- No hard delete allowed (soft delete only if required)
- Must store submission timestamp
- Must include workspace context implicitly via tenant DB

---

## After-Exam Feedback

When submitted after an exam attempt:

- attempt_id must be stored
- module must reflect attempt type
- related_entity_id should reference exam or topic

Feedback submission must not block attempt completion.

Failure in feedback storage must not affect grading.

---

## General Feedback Page

Students may submit general feedback.

Constraints:

- Rate limit enforced (prevent spam)
- Optional rating field
- Module scope = GENERAL

---

## Backoffice Capabilities

Backoffice must support:

- Filter by:
  - module
  - feedback_type
  - rating range
  - date range
  - user
- Search by message text
- Export to CSV
- Aggregate counts by module
- Aggregate average rating

No editing of feedback content allowed.

---

## Performance & Indexing

Required indexes:

- index on module
- index on feedback_type_id
- index on created_at
- index on attempt_id
- GIN index on message (optional for search)

Expected scale:

- Moderate volume per workspace
- Must not degrade exam performance

---

## Rate Limiting

Enforce:

- Max feedback submissions per user per hour
- Prevent duplicate submissions for same attempt

Duplicate detection rule:

One feedback per attempt per user.

---

## Security Rules

- Only authenticated students may submit feedback
- Student can view only their own feedback (optional future enhancement)
- Backoffice staff can view all workspace feedback
- Feedback must not expose internal system data

---

## Observability

Each feedback submission must log:

- workspace_slug
- user_id
- module
- attempt_id (if any)
- request_id

No feedback message content logged.

---

## Not Allowed

- Cross-workspace feedback sharing
- Hard deletion of feedback
- Editing feedback message
- Blocking attempt submission if feedback fails
- Storing feedback in master_db

---

## Validation Criteria

Stage complete when:

- Students can submit feedback after exam
- Students can submit general feedback
- Duplicate prevention works
- Backoffice filters function correctly
- Export works
- Rate limiting enforced
- Logs include workspace context
- Feedback does not affect grading performance

---

Next stage: STAGE_50_SYSTEM_FEEDBACK
