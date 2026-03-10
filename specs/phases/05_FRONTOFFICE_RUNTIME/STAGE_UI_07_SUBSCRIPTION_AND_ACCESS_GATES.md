# STAGE_UI_07_SUBSCRIPTION_AND_ACCESS_GATES

Phase: 05_FRONTOFFICE_RUNTIME  
Layer: Frontend (Vue 3 + Phase 6 Runtime Core)  
Status: DRAFT  
Depends On:

- STAGE_UI_01_FRONTOFFICE_SHELL
- STAGE_UI_02_STUDENT_AUTH
- STAGE_UI_03_DASHBOARD
- STAGE_UI_04_LIBRARY
- STAGE_UI_05_ATTEMPT_RUNTIME
- STAGE_UI_06_RESULTS_AND_CERTIFICATES
- STAGE_60_SUBSCRIPTION_ENFORCEMENT (Backend)

---

## Stage Status

Status: DRAFT

---

## Objective

Implement a unified Subscription & Access Gate layer for the Frontoffice UI.

This stage defines how the frontend:

- Reflects subscription states
- Blocks restricted actions
- Displays access banners
- Handles soft-lock scenarios
- Prevents unauthorized UI navigation

The frontend must NEVER enforce subscription rules independently. It must only reflect backend
decisions.

---

## Architectural Role

The Subscription & Access Gate layer is:

- A UI reflection layer for backend enforcement
- A centralized restriction renderer
- A guard enhancer for route-level decisions

It is NOT:

- A subscription calculator
- A billing validator
- A license engine
- A rule computation engine

All enforcement logic remains server-side.

---

## Subscription States

Frontend must handle the following states (provided by backend APIs):

- ACTIVE
- SOFT_LOCKED
- EXPIRED
- ARCHIVED
- DELETED

State must be available in:

- Auth payload
- Dashboard response
- Library response
- Attempt start response

Frontend must treat backend state as authoritative.

---

## Centralized Subscription Store

Create a global subscription state store that:

- Hydrates from auth/bootstrap API
- Updates when dashboard loads
- Listens to API responses that include subscription_state
- Invalidates on logout

Store must contain:

- subscription_state
- subscription_expiry_date (if provided)
- soft_lock_until (if provided)
- restriction_reason (optional)

This store must NOT derive state itself.

---

## Route-Level Access Gates

### 1. Dashboard

Allowed for:

- ACTIVE
- SOFT_LOCKED
- EXPIRED (read-only)

Blocked for:

- ARCHIVED
- DELETED

---

### 2. Library

Allowed for:

- ACTIVE
- SOFT_LOCKED (if backend allows read)

Restricted for:

- EXPIRED (backend decides access)

---

### 3. Attempt Start

Allowed only if backend permits.

Frontend must:

- Disable “Start Exam” button if subscription not ACTIVE
- Still call backend for final decision

Never trust local state alone.

---

### 4. Attempt Resume

Allowed only if backend returns attempt state.

Frontend must:

- Attempt resume
- Respect 423 / 403 / 409 responses

---

### 5. Results & Certificates

Allowed for:

- ACTIVE
- SOFT_LOCKED
- EXPIRED (historical access)

Must not hide past results.

---

## Global Restriction Banner

When subscription_state != ACTIVE:

Display global banner with:

- Clear explanation
- Expiry date (if available)
- Call-to-action (Renew / Contact Admin)

Banner must:

- Appear consistently across pages
- Not block critical navigation (results viewing allowed)
- Not overlap important content

---

## Soft-Lock Handling

SOFT_LOCKED means:

- New actions may be restricted
- Historical data accessible
- Attempts in progress may continue (backend controlled)

Frontend must:

- Show warning state
- Not assume hard restriction
- Respect backend decisions on every action

---

## Hard Restriction (ARCHIVED / DELETED)

Frontend must:

- Redirect to restricted page
- Show dedicated "Access Restricted" screen
- Clear sensitive state

Restricted screen must:

- Not expose academic data
- Offer contact support information

---

## API Response Handling

When backend returns:

- 423 → Show license locked message
- 402 → Show payment required message (if used)
- 403 → Show access denied
- 409 → Show conflict message
- 426 → Show upgrade required (if version mismatch)

Frontend must not reinterpret codes.

---

## UI Behavior Rules

Frontend must:

- Disable restricted buttons (not hide silently)
- Provide explanation tooltips
- Never rely only on disabling (backend must still validate)
- Avoid duplicate logic per page (centralize logic)

---

## State Synchronization

If subscription state changes mid-session:

Frontend must:

- Update global store
- Re-render banners
- Re-evaluate route guards
- Gracefully restrict new actions

Must NOT:

- Force reload without reason
- Silently allow restricted behavior

---

## Performance Considerations

Subscription check must:

- Not trigger extra API calls
- Be hydrated via existing endpoints
- Avoid redundant polling

Backend remains source of truth.

---

## Accessibility

Restriction banners must:

- Be screen-reader announced
- Have ARIA roles
- Not rely solely on color
- Include clear text explanation

---

## Observability

Frontend logs must include:

- subscription_state_loaded
- subscription_restricted_banner_shown
- restricted_action_attempted
- subscription_state_updated

Must propagate:

- workspace_slug
- student_id
- request_id

No financial data logged.

---

## Security Constraints

Frontend must:

- Never compute subscription validity client-side
- Never bypass backend restriction responses
- Never cache sensitive subscription flags permanently
- Never expose renewal links without authorization

All billing authority remains backend-controlled.

---

## Failure Conditions

Stage fails if:

- Subscription rules duplicated in frontend
- Restricted users can start exams without backend confirmation
- Results hidden incorrectly due to frontend logic
- Hard-restricted users access academic data
- Inconsistent banners across pages

---

## Exit Criteria

Stage complete when:

- Subscription states reflected accurately
- Route-level gates consistent
- Global banner implemented
- Backend responses respected
- All restricted scenarios tested
- No console errors
- Security review passed

Upon completion:

Frontoffice subscription reflection layer is stable and consistent.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
