# PHASE 5 – Frontoffice Runtime Overview

Execution Layer: Frontend (Consumer) + Backend Enforcement  
Governance Level: Server-Authoritative Runtime Enforcement

---

## Phase Objective

Phase 5 implements the student-facing execution portal of Zidney.

This phase does **not** define content.  
It consumes and enforces:

- Platform governance (Phase 1)
- Commercial governance (Phase 2)
- Academic structure (Phase 3)
- Deterministic runtime engine (Phase 4)

Frontoffice is an execution client over constitutionally enforced backend rules.

---

## Strategic Positioning

Frontoffice is:

- A student runtime portal
- A controlled execution interface
- A monetization enforcement boundary
- A consumption layer over deterministic runtime guarantees

Frontoffice is **not**:

- A configuration system
- A business logic authority
- A grading authority
- A license authority
- A subscription authority

All authority remains server-side.

---

## Architectural Model

Frontoffice must follow strict separation:

Frontend responsibilities:

- Render UI state
- Trigger API calls
- Display server-enforced results
- Manage UX transitions
- Handle token storage securely

Backend responsibilities:

- Enforce subscription gates
- Enforce division boundaries
- Enforce license state
- Enforce scheduled exam timing
- Execute attempt lifecycle (Phase 4)
- Validate certificate integrity
- Filter ads safely

Frontend must never bypass backend enforcement.

---

## Scope of Phase 5

This phase includes:

- Student authentication
- Subscription enforcement integration
- Division-based content visibility
- Dashboard aggregation
- Library access
- Live session runtime
- Notification runtime
- Ads runtime
- Results and certificate delivery

This phase does NOT include:

- Content creation
- Academic configuration
- License lifecycle management
- Tenant provisioning
- Runtime grading logic
- Commercial calculations

---

## Runtime Enforcement Model

All runtime gates must be enforced server-side.

### Subscription Enforcement

If subscription expired:

- Login allowed
- Dashboard partially visible
- Profile accessible
- Certificates downloadable
- New attempts blocked
- Paid content hidden

Frontend must reflect restricted state but cannot override it.

---

### Division-Based Visibility

Rules:

- Student sees only content assigned to their division
- Division filtering executed in database queries
- No client-side filtering authority
- Cross-division access impossible

---

### Scheduled Exam Enforcement

Rules:

- Server time is authoritative
- Attempt start validated against schedule window
- Late tolerance enforced server-side
- Auto-submit triggered server-side
- Client timers are UX-only

---

### Attempt Engine Integration

Frontoffice must:

- Trigger attempt start
- Send autosave events
- Trigger submission
- Poll result status
- Display grading result

Frontoffice must NOT:

- Compute score
- Modify grading result
- Recalculate pass/fail
- Modify snapshot

---

### Certificate Integrity

Certificates:

- Generated from stored grading snapshot
- Must not be recalculated retroactively
- Must be reproducible
- Must validate student identity and workspace

---

### Ads Runtime

Ads must:

- Use simple filter-based targeting
- Never access sensitive student data
- Never override subscription logic
- Never block attempt execution

---

### Notifications

Notifications must:

- Support real-time delivery (WebSocket)
- Fall back to polling if needed
- Respect workspace isolation
- Log delivery events

---

## Identity Model

Each student:

- Belongs to exactly one workspace
- Belongs to exactly one division
- May belong to department and group
- Must pass subscription gate for gated content

Cross-workspace identity is forbidden.

---

## Security Model

Frontoffice must enforce:

- Token expiration handling
- Secure storage (httpOnly cookies preferred)
- Automatic logout on invalid token
- Role validation via backend
- No sensitive logic in frontend

All access control remains server-authoritative.

---

## Observability Requirements

Frontend must:

- Propagate request_id
- Log runtime errors
- Report token expiry events
- Report failed attempt submissions
- Avoid logging sensitive data

Backend logs must always include:

- workspace_slug
- student_id
- attempt_id (if applicable)
- request_id

---

## Phase Dependency Requirement

Phase 5 may only begin after:

- Phase 4 runtime validated
- Attempt engine deterministic
- Subscription enforcement stable
- Division filtering confirmed
- Authentication system hardened

Frontoffice cannot compensate for backend instability.

---

## Completion Criteria

Phase 5 is complete when:

- Student authentication stable
- Subscription gates enforced
- Division boundaries enforced
- Attempt engine integrated safely
- Certificate delivery verified
- Ads runtime controlled
- Notification system functional
- No frontend authority bypass possible

At this point:

Zidney execution layer is complete.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
