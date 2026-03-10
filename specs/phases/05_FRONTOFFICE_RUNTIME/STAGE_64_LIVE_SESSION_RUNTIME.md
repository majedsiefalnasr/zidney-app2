# STAGE 64 – Live Session Runtime

Phase: 05_FRONTOFFICE_RUNTIME  
Status: Critical  
Scope: Live session visibility, access control, attendance tracking, and time enforcement

---

## Stage Status

Status: DRAFT

---

## Objective

Define the runtime behavior of the Frontoffice Live Sessions module, including:

- Division-based access control
- Subscription enforcement
- Package/module enforcement
- Time-window validation
- Secure join flow
- Attendance tracking
- Recording visibility

Live sessions are externally hosted (Zoom, Teams, etc.) but controlled by Zidney access rules.

---

## Runtime Visibility Rules

A live session must only be visible if all conditions are satisfied:

1. License status = ACTIVE
2. User authenticated (STUDENT role)
3. Subscription valid
4. Lives module enabled in product
5. Package includes Lives module
6. Division access matches
7. Session status = ENABLED

All checks must be server-side.

Frontend must not control access logic.

---

## Division Scoping

Each session may:

- Be global (no division restriction), or
- Be restricted to specific divisions

Student must only see sessions where:

- session.division_id IS NULL  
  OR
- session.division_id = student.division_id

Division filtering must be applied at query level.

---

## Time Window Enforcement

Each session includes:

- start_datetime
- end_datetime
- duration

Join rules:

- Before start time → joining not allowed
- Between start and end → joining allowed
- After end → joining blocked

Optional tolerance window may be implemented (configurable).

Time authority must be server-based.

Client-side clocks must never be trusted.

---

## Join Flow

Joining a session must follow:

1. Student requests join
2. Backend validates:
   - License ACTIVE
   - Subscription valid
   - Package includes Lives
   - Division match
   - Session status ENABLED
   - Current time within allowed window

3. If valid:
   - Return session URL
   - Record attendance start
4. If invalid:
   - Return appropriate error code

Session URL must not be exposed without validation.

---

## Attendance Tracking

Attendance table must include:

- id
- user_id
- session_id
- joined_at
- left_at (nullable)
- workspace_id

On join:

- Insert attendance record
- joined_at = now

If session exit endpoint implemented:

- Update left_at timestamp

Attendance must not block join flow if logging fails.

---

## Recording Access

If session.recording_available = true:

- Recording visible only after session end
- Same subscription and division rules apply

Recording URL must be protected behind permission validation.

---

## Subscription Enforcement

If subscription expired:

- Student may log in
- Student may view profile
- Student may not access live sessions
- Join endpoint must return 403

Subscription validation must happen before time validation.

---

## Package Enforcement

If Lives module not included in student package:

- Hide Lives menu
- Reject API calls with 403

No partial access allowed.

---

## Session Status Workflow

Session statuses:

- COMPLETED
- UNDER_REVIEW
- APPROVED
- ENABLED

Only ENABLED sessions visible in Frontoffice.

Other statuses must never be exposed.

---

## Security Requirements

The system must prevent:

- Accessing session URL without validation
- Time bypass manipulation
- Division override via client request
- Cross-workspace session access
- Access after subscription expiration

All validation must derive workspace context from resolver middleware.

---

## Observability

Each live session request must log:

- workspace_slug
- user_id
- session_id
- request_id
- join_attempt (true/false)
- result (success/denied)

Attendance creation must be logged with correlation ID.

---

## Failure Cases

If license not ACTIVE: → 423 or 403

If subscription expired: → 403

If division mismatch: → 403

If session not found: → 404

If session not ENABLED: → 403

If outside time window: → 409

All errors must follow platform error standard.

---

## Performance Expectations

Expected scale:

- Hundreds of concurrent join requests
- Minimal DB load
- Low-latency validation

Required indexes:

- division_id
- start_datetime
- end_datetime
- status

---

## Forbidden

- Direct exposure of session URL
- Frontend-only validation
- Ignoring time checks
- Ignoring division checks
- Joining after session ended
- Cross-workspace access

---

## Completion Criteria

Stage complete when:

- Division scoping verified
- Subscription enforcement verified
- Package enforcement verified
- Time window enforcement verified
- Join flow validated
- Attendance records created correctly
- Recording access controlled
- Logs include required metadata
- Unauthorized access blocked

Live Sessions must be stable before moving to:

STAGE_65_NOTIFICATION_SYSTEM
