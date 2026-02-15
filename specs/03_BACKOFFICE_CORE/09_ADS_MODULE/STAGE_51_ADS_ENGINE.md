# STAGE 51 – Ads Engine

Phase: 3 – Backoffice Core  
Domain: Ads Module  
Status: Controlled Monetization Layer  
Scope: Workspace-level advertisement configuration, targeting, and runtime display

---

## Objective

Implement a workspace-isolated Ads Engine that:

- Allows Backoffice to create and manage ads
- Supports controlled placement in Frontoffice
- Enables simple filter-based targeting
- Ensures ads never interfere with exam integrity
- Supports monetization and engagement use cases
- Respects tenant isolation strictly

Ads are optional per workspace.

The engine must never degrade exam performance or attempt stability.

---

## Core Principles

- Ads are workspace-scoped
- Ads must not block core academic flows
- Ads must load asynchronously
- Ads must be configurable per placement
- Ads must respect targeting filters
- Ads must be fully disable-able per workspace

No cross-tenant ad distribution allowed.

---

## Data Model (Tenant Database)

### ads

Fields:

- id
- title
- type (IMAGE | VIDEO | TEXT | HTML)
- content_url (nullable)
- content_html (nullable)
- placement (DASHBOARD | BEFORE_EXAM | AFTER_EXAM | LIBRARY | LIVES)
- start_at (nullable)
- end_at (nullable)
- priority (integer)
- enabled (boolean)
- created_at
- updated_at

Rules:

- Either content_url or content_html must be provided
- start_at and end_at define active window
- priority determines order when multiple ads eligible

---

### ads_targeting

Fields:

- id
- ad_id
- division_id (nullable)
- department_id (nullable)
- group_id (nullable)

Rules:

- Null fields = no restriction for that dimension
- Multiple targeting rows allowed per ad
- Targeting uses inclusive OR logic across rows
- Within a row, all specified filters must match

---

## Placement Rules

Supported placements:

- Dashboard
- Before Exam
- After Exam
- Library
- Live Sessions

Placement constraints:

- BEFORE_EXAM must load before attempt start
- AFTER_EXAM must load after submission only
- Ads must never interrupt submission API
- Ads must never alter grading logic

Exam runtime must not wait for ad rendering.

---

## Targeting Logic

Target filters supported:

- Division
- Department
- Group

Evaluation algorithm:

1. Validate ad is enabled
2. Validate current timestamp within window
3. Validate placement match
4. Evaluate targeting:
   - If no targeting rows → show to all users
   - If targeting rows exist → match user assignment
5. Sort by priority
6. Return eligible ads

Targeting is simple filter-based only.

No rules engine in Phase 3.

---

## Workspace-Level Controls

Workspace Settings must include:

- ads_enabled (boolean)
- max_ads_per_placement (integer, default 1)

If ads_enabled = false:

- Ads API must return empty result
- No runtime evaluation

---

## Performance Constraints

Ads must:

- Be fetched via lightweight endpoint
- Be cached briefly (e.g., 60 seconds per user)
- Not block exam submission
- Not trigger DB-heavy joins

Index requirements:

- enabled
- placement
- start_at
- end_at

Targeting tables must be indexed by:

- division_id
- department_id
- group_id

---

## Security Rules

- Only Backoffice authorized roles may manage ads
- Ads content_html must be sanitized
- No arbitrary script injection allowed
- CSP (Content Security Policy) recommended
- No external script tags allowed in content_html

Media-based ads must reference Media Library system.

---

## Observability

Every ad display event must log:

- workspace_slug
- user_id
- ad_id
- placement
- timestamp
- request_id

No tracking beyond this unless explicit analytics phase added.

---

## Abuse Prevention

- Rate limit ad creation
- Prevent extremely large HTML payloads
- Prevent overlapping excessive active ads
- Limit maximum active ads per placement

---

## Validation Criteria

Stage complete when:

- Ads can be created and edited in Backoffice
- Ads respect placement
- Ads respect targeting filters
- Ads can be disabled per workspace
- Ads never block exam submission
- Cross-tenant isolation verified
- HTML sanitized
- Logs generated correctly

---

## Not Allowed

- Cross-workspace ad sharing
- Blocking submission while loading ads
- Script injection
- Runtime dependency on ad success
- Heavy DB queries during exam session

---

## Stability Principle

Ads are a secondary layer.

They must never:

- Interfere with grading
- Interfere with authentication
- Interfere with license enforcement
- Interfere with attempt engine

Core academic runtime always takes priority.
