# STAGE_UI_01_FRONTOFFICE_SHELL

Phase: 05_FRONTOFFICE_RUNTIME  
Layer: Frontend (Vue 3 + Phase 6 Runtime Core)  
Status: DRAFT  
Depends On:

- PHASE_4_RUNTIME (Backend Deterministic Attempt Engine)
- PHASE_6_UI_APPLICATION_RUNTIME (UI Core Architecture)

---

## Stage Status

Status: DRAFT

---

## Objective

Establish the structural shell of the Frontoffice application.

This stage defines:

- Global layout
- Routing structure
- Route guards
- Navigation framework
- Authentication boundary
- Error boundary integration

This stage does **not** implement business features.

It prepares the execution container for all student-facing functionality.

---

## Architectural Position

Frontoffice Shell is:

- A structural container
- A routing orchestrator
- An authentication boundary
- A layout provider

Frontoffice Shell is NOT:

- A grading engine
- A subscription authority
- A business logic layer
- A state mutation authority

All business enforcement remains backend-authoritative.

---

## Layout Structure

The shell must include:

- Top navigation bar
- Optional sidebar (responsive)
- Main content router-view container
- Notification mount point
- Global loading overlay
- Error boundary wrapper

Responsive behavior required:

- Desktop: sidebar visible
- Tablet/mobile: collapsible navigation
- Attempt mode: minimal distraction layout

---

## Router Structure

Define high-level route groups:

Public:

- /login

Authenticated:

- /dashboard
- /library
- /attempt/:id
- /results/:id
- /certificates/:id
- /live/:sessionId
- /notifications
- /profile

Fallback:

- 404 page
- Global error page

Router must be created via Phase 6 router architecture.

---

## Route Guards

Route guards must enforce:

1. Authentication required
2. Token validity
3. Workspace scope validation
4. Role = student
5. Subscription gating (read-only; backend enforced)

Rules:

- Guard does not compute authorization.
- Guard validates session existence.
- Guard redirects on invalid token.
- Guard handles 401 and 403 centrally.

No route may bypass guard layer.

---

## Authentication Boundary

Shell must:

- Mount after auth state resolved
- Show loading state while validating token
- Redirect to /login if unauthenticated
- Auto-logout on token expiration
- Clear state on logout

Token handling must follow:

STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING (Phase 6)

---

## Global State Integration

Shell integrates with:

- Auth store
- Workspace store
- Notification store
- Error store
- Loading store

State must be centralized (Pinia).

No ad-hoc component-level auth logic allowed.

---

## Error Boundary

Shell must:

- Catch uncaught route errors
- Render fallback UI
- Provide retry mechanism
- Log errors via centralized logger

Errors must respect RFC 7807 structure.

---

## Navigation Model

Navigation must be dynamic:

Show items based on:

- Authentication state
- Subscription status
- Active attempt state
- Notification count

Navigation must never:

- Infer authorization beyond what backend provides
- Reveal restricted routes
- Allow deep-link bypass without guard

---

## Attempt Mode Layout Variant

When user enters /attempt/:id:

- Hide main navigation
- Hide ads
- Disable extraneous UI
- Enable focused layout
- Prevent route switching during active attempt (confirm dialog required)

This prevents accidental exit during exam.

---

## Observability

Shell must propagate:

- request_id
- workspace_slug
- student_id (if available)

Frontend logs must:

- Avoid sensitive data
- Log navigation failures
- Log token expiration events
- Log route guard failures

---

## Accessibility Requirements

- Keyboard navigable layout
- Focus management on route change
- Screen reader friendly navigation labels
- High-contrast compliance
- Responsive breakpoints verified

---

## Security Constraints

Shell must NOT:

- Store tokens in localStorage (unless secure strategy defined)
- Perform grading logic
- Perform subscription enforcement client-side
- Cache sensitive responses improperly
- Allow cross-workspace navigation

All security authority remains server-side.

---

## Failure Conditions

This stage fails if:

- Routes accessible without authentication
- Deep link bypass possible
- Attempt route usable without token
- Navigation reveals restricted content
- Token expiration not handled
- Layout allows exit during active attempt without confirmation

---

## Exit Criteria

Stage is complete when:

- Layout stable across breakpoints
- Router configured and guarded
- Auth boundary enforced
- Attempt layout variant operational
- Error boundary functional
- State integration centralized
- No console errors on route transitions

Upon completion:

Frontoffice structural foundation is ready for feature stages.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
