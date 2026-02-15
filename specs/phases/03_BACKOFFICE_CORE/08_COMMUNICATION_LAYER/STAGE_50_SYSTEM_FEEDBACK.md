# STAGE 50 – System Feedback

Phase: 3 – Backoffice Core  
Domain: Communication Layer  
Status: Critical  
Scope: Structured collection and management of technical/system-level feedback within a workspace

---

## Objective

Implement a System Feedback module that captures:

- Technical issues
- Performance degradation reports
- Bug reports
- Infrastructure-related incidents
- Security-related alerts (non-sensitive)
- Feature improvement suggestions

This module is distinct from academic feedback (STAGE 49).

System feedback is operational in nature and intended for internal staff and administrators only.

---

## Separation from Academic Feedback

System Feedback must:

- Be stored in a separate table
- Not mix with student academic feedback
- Not affect grading or academic analytics
- Not be visible to students

Academic Feedback = experience-related  
System Feedback = technical/platform-related

Strict separation required.

---

## Data Model (Tenant Database)

Table: system_feedback

Fields:

- id
- reported_by_user_id (nullable for anonymous reports)
- reporter_role (STAFF | STUDENT | SYSTEM)
- category (BUG | PERFORMANCE | SECURITY | FEATURE | OTHER)
- module (MCQ | EXAM | LIBRARY | LIVES | DASHBOARD | GENERAL)
- severity (LOW | MEDIUM | HIGH | CRITICAL)
- title
- description
- metadata (jsonb nullable)
- status (OPEN | IN_PROGRESS | RESOLVED | REJECTED)
- assigned_to_user_id (nullable)
- created_at
- updated_at
- resolved_at (nullable)

Indexes required on:

- status
- severity
- created_at
- module

---

## Submission Sources

System feedback can originate from:

1. Backoffice staff reporting issue
2. Frontoffice student reporting technical issue
3. Automatic system detection (future enhancement)

Submission rules:

- Must be authenticated
- Must be rate limited
- Must be workspace-isolated
- Must not expose internal stack traces to end user

---

## Visibility & Permissions

Access rules:

- Students may submit but cannot view system feedback list
- Staff can view and filter all workspace system feedback
- Only authorized roles may change status
- Only authorized roles may assign feedback

Role-based permission required:

- system_feedback_view
- system_feedback_manage
- system_feedback_assign

---

## Workflow Model

Default workflow:

OPEN → IN_PROGRESS → RESOLVED  
OPEN → REJECTED

Rules:

- Only OPEN issues can be assigned
- Only IN_PROGRESS issues can be marked RESOLVED
- RESOLVED and REJECTED are terminal states
- No hard delete allowed

Status transitions must be logged.

---

## Metadata Support

metadata (jsonb) may include:

- browser_info
- device_info
- OS
- app_version
- attempt_id (if relevant)
- request_id
- performance_metrics (if applicable)

Sensitive information must not be stored:

- passwords
- JWT tokens
- full stack traces
- raw SQL queries

---

## Performance & Safety Rules

System feedback submission must:

- Not block primary flows (exam, grading, login)
- Execute asynchronously if heavy processing required
- Log request_id for traceability
- Respect rate limits (max 5 submissions per user per hour)

---

## Observability Integration

Every submission must log:

- workspace_slug
- reporter_user_id
- category
- severity
- request_id

No description content logged in full.

Critical severity must trigger:

- Structured log with severity=error
- Optional notification to admin (future enhancement)

---

## Archival Policy

System feedback:

- Never deleted automatically
- May be archived after defined retention period (future phase)
- Must remain queryable for audit

---

## Validation Criteria

Stage complete when:

- Staff can submit system feedback
- Students can submit system feedback
- Staff can filter by category, severity, status
- Assignment works
- Status transitions enforced
- Rate limiting enforced
- Isolation verified
- Logs contain workspace context
- No sensitive data leakage confirmed

---

## Not Allowed

- Mixing with academic feedback
- Hard deletion
- Cross-tenant visibility
- Blocking critical workflows
- Storing sensitive credentials

---

## Stability Principle

System Feedback must enhance operational visibility without increasing platform instability.

It must never interfere with:

- Attempt engine
- Authentication
- License enforcement
- Tenant isolation
