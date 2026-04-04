# STAGE 44 – Plans & Subscriptions

Phase: 3 – Backoffice Core Domain: Commercial Layer Scope: Student subscription management per
workspace

---

## Stage Status

Status: DRAFT
Step: pre_step
Risk Level: UNKNOWN
Initiated: 2026-04-04T00:00:00.000Z

Scope Open:

- Specification pending

Architecture Governance Compliance:

- Pending governance audit

Notes:
Stage initialized. Specification in progress.

---

## 🎯 Objective

Implement the subscription system inside each workspace to:

- Define sellable plans (packages)
- Control access to Frontoffice features
- Enforce subscription validity
- Support manual and gateway-based activation
- Support expiration and renewal logic

This stage governs B2C access control inside a workspace.

License limits (B2B) are handled in Stage 43. This stage handles student subscriptions only.

---

## Core Concepts

### Plan (Package)

A configurable commercial entity created by Backoffice admin.

Defines:

- Name
- Description
- Price
- Billing type (one-time | recurring)
- Duration (days/months)
- Enabled modules
- Active status

Plans are workspace-scoped and not shared across tenants.

### Subscription

Represents a student’s active access to a plan.

Each subscription must include:

- id
- student_id
- plan_id
- status (ACTIVE | EXPIRED | CANCELED | PENDING)
- started_at
- expires_at
- auto_renew (boolean)
- payment_method (MANUAL | GATEWAY)
- created_at
- updated_at

A student may have multiple subscriptions over time, but only one ACTIVE at a time.

---

## Plan Configuration Rules

Backoffice admin can:

- Create new plans
- Edit plans
- Disable plans
- Delete plans (only if no active subscriptions exist)

Plan deletion must be blocked if:

- Active subscriptions reference the plan
- Historical subscription data exists (soft delete only)

Plans must be versioned implicitly via immutable ID. Editing a plan does not affect historical
subscriptions.

---

## Subscription Activation Flow

### Manual Activation

Backoffice admin: 1. Select student 2. Select plan 3. Define start date 4. Confirm activation

System:

- Create subscription record
- Set status = ACTIVE
- Set expires_at based on plan duration

### Gateway Activation

If workspace uses payment gateway: 1. Student selects plan 2. Payment initiated 3. On successful
callback:

- Create subscription
- Activate

Payment failure:

- Do not create subscription
- Log failure

---

## Subscription Enforcement (Frontoffice)

On every Frontoffice API request:

Middleware must: 1. Load active subscription for student 2. Validate:

- status = ACTIVE
- expires_at > now()

If invalid:

- Allow login
- Block dashboard content
- Return subscription_required flag
- Allow access to:
- Profile
- Certificates (historical)
- Payment page

Expired subscription:

- Status becomes EXPIRED
- Access blocked

---

## Expiration Logic

Expiration must be enforced at runtime.

No cron-only dependency.

If now() > expires_at:

- Auto-transition to EXPIRED
- Block feature access immediately

Recurring subscriptions:

If auto_renew = true:

- Attempt renewal before expiration
- On failure → mark EXPIRED

---

## Module Access Mapping

Each plan defines enabled modules:

Examples:

- MCQ
- Traditional Exams
- Library
- Live Sessions

Access logic:

If module not enabled in plan: → Frontoffice must hide module → API must block access

Module enforcement must exist in backend. Frontend visibility is secondary.

## Subscription Integrity Rules

- A student cannot have two ACTIVE subscriptions simultaneously.
- Starting new subscription auto-expires previous one.
- Subscription dates immutable once expired.
- Historical subscriptions must remain queryable.

---

## Reporting Requirements

Backoffice must support:

- List subscriptions by student
- List active subscriptions
- Expired subscriptions
- Revenue overview (manual + gateway)

MMC does not access student subscriptions directly.

---

## Validation Criteria

Stage complete when:

- Plans can be created
- Plans can be edited safely
- Manual activation works
- Gateway activation works
- Expiration enforced
- Frontoffice access blocked without subscription
- Module-based access control enforced
- Only one active subscription per student
- Historical subscriptions preserved

---

## Not Allowed

- Shared subscription table across tenants
- Subscription enforcement only in frontend
- Soft-limit overflow
- Deleting subscription history
- Allowing multiple active subscriptions

---

## Stability Principle

Subscription logic controls student access.

If enforcement fails:

- Revenue leakage occurs
- Institutional trust is compromised

No Frontoffice runtime expansion until subscription enforcement is verified.
