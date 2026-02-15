# PHASE 5 – Frontoffice Runtime

## Purpose

This phase defines the student-facing runtime layer of Zidney.

It governs how students authenticate, access content, take exams, receive results, and interact with monetization and communication systems.

This phase executes on top of:

- Platform Foundation (Phase 1)
- MMC governance (Phase 2)
- Backoffice content and structure (Phase 3)
- Attempt engine runtime (Phase 4)

Frontoffice does not define content.
It consumes and enforces content.

---

## Strategic Positioning

Frontoffice is not a marketing portal.

Frontoffice is:

A student learning and examination runtime portal with exams as its core.

Its responsibility is controlled execution, not configuration.

---

## Scope

This phase includes:

- Student authentication
- Subscription enforcement
- Content visibility filtering
- Dashboard aggregation
- Library runtime access
- Live session runtime
- Notification runtime
- Ads runtime
- Results and certificate runtime

It does not include:

- Content creation
- Academic structure configuration
- Role configuration
- License lifecycle
- Tenant provisioning

---

## Runtime Responsibilities

Frontoffice must:

- Enforce division-based visibility
- Enforce subscription gates
- Enforce scheduled exam timing
- Execute attempts through Phase 4 engine
- Deliver real-time notifications
- Render certificates based on stored snapshots
- Apply ad placement logic safely

All enforcement must happen server-side.

Frontend may reflect state but must never control it.

---

## Architectural Principles

All access control must be server-enforced.

Subscription checks must run at middleware level.

Division filtering must be applied in database queries.

Certificate validity must never change retroactively.

Ads must use simple filter-based targeting.

Notifications must support real-time WebSocket delivery.

---

## Identity Model

Each student:

- Belongs to exactly one workspace
- Belongs to exactly one division
- May optionally belong to department and group
- Must pass subscription gate for content access

No cross-workspace identity allowed.

---

## Enforcement Rules

Expired subscription:

- Login allowed
- Dashboard restricted
- Profile accessible
- Certificates downloadable
- New attempts blocked

Division enforcement:

- Student only sees content assigned to their division
- Student cannot override division filters

Scheduled exams:

- Server time authority required
- Late tolerance validated server-side
- Auto-submit enforced on expiration

---

## Deliverable

A stable, secure student runtime portal that:

- Enforces monetization correctly
- Enforces academic boundaries strictly
- Integrates cleanly with attempt engine
- Delivers consistent student experience
- Maintains institutional trust

Phase 5 completes the execution layer of Zidney.
