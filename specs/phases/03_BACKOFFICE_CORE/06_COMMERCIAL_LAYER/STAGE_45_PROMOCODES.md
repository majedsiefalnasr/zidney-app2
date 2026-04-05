# STAGE 45 – Promocodes

Phase: 3 – Backoffice Core  
Domain: Commercial Layer  
Scope: Workspace-level discount and affiliate code system

---

## Stage Status

Status: IN PROGRESS
Step: analyze
Risk Level: MEDIUM
Last Updated: 2026-04-05T03:00:00.000Z

Drift Analysis: PASSED (all criteria — 5 guardian composite)

Implementation: AUTHORIZED

Scope Authorized:

- Workspace-scoped promocode CRUD + validation engine (9 checks)
- PERCENTAGE / FIXED / FREE_TRIAL discount types
- Atomic `applyPromocode` integrated into SERIALIZABLE subscription transaction
- Backoffice analytics endpoint
- 29 tasks across 14 phases

Deferred Scope:

- Affiliate marketing logic (explicitly deferred per stability principle)
- Advanced marketing rules
- Cross-workspace analytics (forbidden per ADR-0001)
- Analytics materialization/caching strategy
- PG serialization error (40001) retry test (acceptable deferral)
- `.trim()` / `.toUpperCase()` additions — implementation-time detail

Architecture Governance Compliance:

- All drift criteria passed — implementation authorized
- Architecture Guardian: PASS
- API Designer: PASS
- Security Auditor: PASS
- Performance Optimizer: PASS
- QA Engineer: PASS
- Code Reviewer: PASS

Notes:
Full composite drift analysis passed (5 guardians). All CRITICAL/HIGH findings resolved in spec artifacts.
Implementation gate open.

---

## Objective

Implement a workspace-scoped promocode system that:

- Applies discounts to student subscription plans
- Supports percentage, fixed amount, and free-trial logic
- Enforces usage limits and validity windows
- Supports targeting by academic structure
- Integrates with subscription activation flow

Promocodes are isolated per workspace. No cross-workspace sharing allowed.

---

## Core Concepts

### Promocode

Represents a discount configuration created by Backoffice admin.

Fields:

- id
- code (unique per workspace)
- type (PERCENTAGE | FIXED | FREE_TRIAL)
- value (numeric; required for PERCENTAGE and FIXED)
- free_trial_days (required for FREE_TRIAL)
- valid_from
- valid_until
- usage_limit (nullable for unlimited)
- per_user_limit (nullable; default = 1)
- applies_to_plan_ids (array or relation table)
- target_division_ids (nullable)
- target_group_ids (nullable)
- is_stackable (boolean; default = false)
- is_active (boolean)
- created_at
- updated_at

Code rules:

- Case-insensitive match
- Must be unique inside workspace
- Immutable after creation

---

## Promocode Usage Table

Each redemption must be stored in:

promocode_usages:

- id
- promocode_id
- student_id
- subscription_id
- discount_amount
- redeemed_at

Usage must be recorded transactionally with subscription creation.

---

## Discount Calculation Rules

### Percentage

final_price = plan_price - (plan_price \* percentage / 100)

Must not reduce below zero.

### Fixed

final_price = plan_price - fixed_amount

Must not reduce below zero.

### Free Trial

- Subscription created with price = 0
- expires_at extended by free_trial_days
- Only applicable for recurring plans

---

## Validation Rules

On promocode application:

System must validate:

1. Code exists
2. is_active = true
3. Current time within valid_from and valid_until
4. usage_limit not exceeded
5. Student per_user_limit not exceeded
6. Plan eligible
7. Student belongs to allowed division/group (if targeting configured)

If any validation fails: → Reject with 400 → Provide structured error code

---

## Stacking Rules

If is_stackable = false:

- Only one promocode allowed per subscription

If is_stackable = true:

- Multiple codes allowed
- Must apply in deterministic order
- Total discount must not exceed plan_price

Stacking must be explicitly enabled. Default behavior: no stacking.

---

## Integration with Subscription Flow

Promocode validation must occur before:

- Manual subscription activation
- Gateway payment finalization

If payment gateway used:

- Discounted amount must be sent to gateway
- Server must revalidate on callback

Never trust client-calculated discount.

---

## Expiration Behavior

If promocode expires:

- Cannot be applied to new subscriptions
- Does not affect existing subscriptions

Historical usage must remain queryable.

---

## Analytics & Reporting

Backoffice must support:

- Total redemptions per code
- Revenue impact
- Active vs expired codes
- Usage by division/group

MMC does not access individual student-level promocode data.

---

## Validation Criteria

Stage complete when:

- Promocode can be created
- Validation works correctly
- Usage limit enforced
- Per-user limit enforced
- Targeting enforced
- Discount calculated correctly
- Stacking rules enforced
- Usage stored transactionally
- Expired code rejected

---

## Not Allowed

- Global promocodes across workspaces
- Client-side-only validation
- Negative pricing
- Deleting usage history
- Modifying code string after creation

---

## Stability Principle

Promocodes affect revenue.

If validation fails or stacking misbehaves:

- Revenue leakage occurs
- Financial reporting becomes inaccurate

This stage must be stable before expanding affiliate logic or advanced marketing rules.
