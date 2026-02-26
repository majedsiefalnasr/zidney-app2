# STAGE_UI_05_COMMERCIAL_LAYER

Phase: 03_BACKOFFICE_CORE  
Track: UI (apps/backoffice)

Backend Dependencies:

- STAGE_44_PLANS_AND_SUBSCRIPTIONS
- STAGE_45_PROMOCODES
- STAGE_46_BILLING_AND_INVOICES

UI Dependencies:

- STAGE_UI_01_BACKOFFICE_SHELL
- STAGE_UI_04_USER_MANAGEMENT

---

## Purpose

This stage implements the Backoffice Commercial UI layer, enabling institutions to:

- View active subscription plan
- Upgrade / downgrade (if allowed)
- Manage promo codes
- View invoices
- Monitor billing status
- Track subscription usage metrics

UI must consume backend APIs strictly.

No billing calculations, pricing logic, or subscription validation may be implemented client-side.

---

## Architectural Constraints

Commercial UI must:

- Be tenant-scoped only
- Never access master database directly
- Never calculate pricing locally
- Never validate promo discount locally
- Use centralized API client
- Respect license state middleware

Backend remains authoritative for:

- Plan pricing
- Billing cycle logic
- Subscription limits
- Promo code validation
- Invoice generation
- Payment state transitions

---

## Module Breakdown

### 1️⃣ Subscription Overview

UI must display:

- Current plan name
- Billing cycle (monthly / yearly)
- Status (ACTIVE / SOFT_LOCKED / ARCHIVED)
- Next renewal date
- Usage metrics (students, staff, storage, etc.)
- Limit indicators

Important:

Usage metrics are informational only.

Limit enforcement remains backend-controlled.

If subscription inactive:

- Display clear blocking banner
- Disable restricted actions

---

### 2️⃣ Plan Management

UI must support:

- View available plans
- Compare plans
- Request upgrade/downgrade (if backend allows)
- Display plan features

Constraints:

- Plan pricing must come from backend
- No client-side price math
- No client-side tax calculation
- No direct payment processing in Backoffice (if external gateway used)

If backend returns conflict:

- Display informative message
- Do not retry automatically

---

### 3️⃣ Promo Code Management

UI must allow:

- Create promo code (if institution-level supported)
- Activate / deactivate promo code
- Set expiration date
- Define discount percentage or fixed amount
- View usage count

Validation Rules:

- Promo code format enforced by backend
- UI must sanitize input
- Prevent duplicate codes (backend validated)

Security:

- Promo codes must never be logged in plaintext in console
- Mask codes in logs if required

---

### 4️⃣ Billing & Invoice History

UI must support:

- List invoices
- View invoice details
- Download invoice PDF (if backend supports)
- View payment status (PAID / PENDING / FAILED)
- Display transaction reference

Constraints:

- UI must not generate invoices
- Invoice status must reflect backend state
- PDF links must be secure and short-lived

---

### 5️⃣ Payment Status Handling

UI must handle:

- 402 Payment Required
- 423 License Soft Locked
- 403 Archived
- 409 Plan conflict

When payment failure occurs:

- Show renewal instructions
- Offer contact support link
- Do not expose internal error details

---

## License State Awareness

Commercial UI must reflect:

- ACTIVE → Full functionality
- SOFT_LOCKED → Restricted functionality (view-only for critical areas)
- ARCHIVED → Read-only mode
- DELETED → Redirect to support

UI must not override license restrictions.

All enforcement remains backend-controlled.

---

## Security Requirements

Must prevent:

- Price tampering via DevTools
- Promo code injection
- Unauthorized invoice access
- Cross-tenant invoice access
- Payment flow bypass

All invoice downloads must verify authorization.

---

## Observability Requirements

Client logs must include:

- subscription_view
- plan_change_request
- promo_create_attempt
- invoice_download_attempt

Include:

- workspace_slug
- correlation_id

Never log:

- Payment tokens
- Raw promo codes
- Sensitive billing metadata

---

## Performance Considerations

Commercial data is typically small.

However:

- Invoice list must use pagination
- Avoid refetching static plan data repeatedly
- Cache allowed plan list for session

No blocking network waterfall on dashboard load.

---

## E2E Validation Scenarios

Mandatory tests:

1. View active subscription
2. Attempt upgrade request
3. Create valid promo code
4. Attempt invalid promo code
5. View invoice list
6. Download invoice
7. Simulate payment failure
8. Simulate license soft lock
9. Attempt restricted action under SOFT_LOCKED
10. Verify RBAC restriction

All must pass before stage completion.

---

## Completion Criteria

Stage complete when:

- Subscription overview accurate
- Plan management functional
- Promo codes manageable
- Invoice list accessible
- License state reflected correctly
- No pricing logic in UI
- No console errors
- E2E scenarios pass

---

## Governance Rule

Backoffice Commercial UI must never:

- Compute billing logic
- Override license restrictions
- Persist financial data locally
- Handle raw payment credentials

All financial authority remains in backend services.

---
