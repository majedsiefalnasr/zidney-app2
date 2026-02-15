# STAGE_60_SUBSCRIPTION_ENFORCEMENT

Phase: 05_FRONTOFFICE_RUNTIME  
Scope: Runtime subscription-based access control  
Runtime: Backend API + Frontoffice

---

## Objective

Implement strict subscription-based access control for student users.

Subscription enforcement must:

- Be server-authoritative
- Be workspace-isolated
- Be deterministic
- Never rely on frontend-only checks
- Never modify attempt logic
- Never bypass license validation

Subscription is a runtime access filter, not an authentication filter.

---

## Subscription Model

Subscription is:

- Per user
- Single active plan at a time
- Stored inside tenant database
- Independent from license lifecycle

A user may have:

- ACTIVE subscription
- EXPIRED subscription
- NO subscription

Only ACTIVE subscription grants runtime content access.

---

## Required for Access

Subscription is mandatory for accessing:

- MCQ Assessments
- MCQ Exams
- MCQ Scheduled Exams
- Traditional Topics
- Exercises
- Scheduled Exams
- Library content
- Live sessions
- Dashboard academic content

Subscription is not required for:

- Login
- Profile access
- Certificate viewing
- Certificate download
- Settings page

---

## Enforcement Layer

Subscription must be validated in backend middleware.

Flow:

1. Validate JWT
2. Validate workspace
3. Validate license ACTIVE
4. Load subscription for user
5. Attach subscription_status to request context
6. Enforce access per endpoint

Frontend may hide UI, but backend must enforce.

---

## Subscription States

ACTIVE

- access allowed

EXPIRED

- limited access only
- runtime endpoints blocked

NONE

- treated as EXPIRED

Status must be calculated using:

- subscription.start_date
- subscription.end_date
- current server time

Server time is authoritative.

---

## Enforcement Points

Subscription must be validated before:

- Attempt start
- Attempt reconnection
- Fetching exam lists
- Fetching library content
- Fetching live sessions
- Scheduled exam entry

If subscription invalid:

Return 402 or 403 (platform decision)

Recommended: 402 Payment Required

Do not allow partial content exposure.

---

## Attempt Interaction Rule

If subscription expires while attempt is IN_PROGRESS:

Option A (Recommended):

- Allow attempt completion
- Do not block submission
- Block new attempt start

Rationale:

- Preserve academic fairness
- Prevent data loss
- Avoid mid-exam interruption

Subscription enforcement applies only at attempt start.

---

## Scheduled Exam Behavior

If subscription expired before scheduled exam start:

- User cannot enter exam
- Return 402

If subscription expires during scheduled exam:

- Allow completion
- Do not auto-submit due to subscription

Subscription must not interfere with time-based submission.

---

## Plan Feature Filtering

Plans may define:

- Enabled modules
- Content limits
- Feature access

Subscription enforcement must also verify:

- Requested module is included in plan
- Requested feature allowed

If plan does not include module:

Return 403.

Plan filtering must not be handled in frontend only.

---

## Security Guarantees

Subscription enforcement must:

- Validate ownership
- Validate workspace isolation
- Prevent cross-user access
- Prevent bypass via query manipulation
- Prevent access via direct API call

No endpoint may trust client-declared subscription state.

---

## Observability Requirements

Every blocked request must log:

- workspace_slug
- user_id
- subscription_status
- endpoint
- request_id

Must not log sensitive financial details.

---

## Validation Criteria

Stage complete when:

- Expired subscription blocks content access
- Login still allowed
- Certificates still accessible
- Attempt start blocked when expired
- In-progress attempt unaffected
- Plan module filtering enforced
- Cross-tenant access prevented
- Subscription state derived from server time

---

## Forbidden

- Frontend-only enforcement
- Blocking submission due to subscription expiration
- Allowing attempt start without active subscription
- Reading subscription from JWT without DB validation
- Modifying grading based on subscription

Subscription enforcement is a runtime access guard.
It must be deterministic and server-authoritative.
