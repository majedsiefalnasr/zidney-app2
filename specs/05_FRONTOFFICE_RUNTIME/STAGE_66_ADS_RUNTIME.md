# STAGE 66 – Ads Runtime

Phase: 05_FRONTOFFICE_RUNTIME

---

## Objective

Implement a deterministic, non-blocking advertisement runtime for Frontoffice.

The Ads Runtime must:

- Render ads based on workspace configuration
- Respect user segmentation (division / department / group)
- Support multiple placement locations
- Never interfere with exam stability
- Be fully workspace-isolated

Ads are a workspace-controlled monetization and engagement feature.

---

## Scope

This stage covers runtime behavior only.

Ad creation and configuration are defined in:
STAGE_51_ADS_ENGINE

---

## Placement Locations

Supported placements:

- DASHBOARD
- BEFORE_EXAM
- AFTER_EXAM
- LIBRARY
- LIVE_SESSION

Placement must be explicitly declared in ad configuration.

---

## Targeting Rules

Ads may be filtered by:

- division_id (optional)
- department_id (optional)
- group_id (optional)

Rules:

- If no targeting defined → visible to all students
- If targeting defined → student must match all provided filters
- No advanced rule engine in Phase 1
- No behavioral targeting
- No cross-workspace targeting

Filtering logic must execute server-side.

---

## Runtime Flow

On eligible page load:

1. Validate workspace license (must be ACTIVE)
2. Validate workspace ads_enabled = true
3. Resolve student segmentation (division / department / group)
4. Query active ads for placement
5. Apply segmentation filters
6. Return safe ad payload

Ad payload must contain only:

- id
- title
- description
- media_url
- target_url
- placement

No internal configuration fields exposed.

---

## Exam Safety Rules

Ads must never:

- Delay exam start
- Block submission
- Inject into question container
- Interfere with autosave
- Inject scripts into exam runtime

For BEFORE_EXAM placement:

- Render in separate pre-start screen
- Student must manually proceed to exam

For AFTER_EXAM placement:

- Render after submission confirmation
- Never replace results screen

Exam runtime stability has priority over ad rendering.

---

## Workspace Controls

Workspace settings must include:

- ads_enabled (boolean)

If disabled:

- All ad queries return empty list
- Runtime must not attempt to render placeholders

---

## Performance Constraints

Ad query must:

- Use indexed fields (placement, active, date_range)
- Avoid full table scans
- Execute under 50ms

Ads must not trigger additional heavy joins.

Media files must be served via CDN or static storage.

---

## Analytics (Minimal Phase 1)

Track per workspace:

- impressions_count
- clicks_count

Tracking must:

- Be asynchronous
- Not block page rendering
- Not block exam runtime

No cross-workspace aggregation unless workspace explicitly opted-in.

---

## Security Rules

- Ads belong strictly to tenant database
- No shared ad storage
- No script injection allowed in ad content
- URLs must be sanitized
- No raw HTML injection

Only safe-rendered content allowed.

---

## Validation Criteria

Stage complete when:

- Ads render correctly per placement
- Segmentation filtering works
- Ads disabled hides all ads
- Ads do not interfere with exam runtime
- Impression tracking works
- Click tracking works
- Cross-workspace isolation verified

---

## Hard Constraints

- No dynamic rule engine in Phase 1
- No behavioral tracking
- No third-party script injection
- No blocking requests during exam runtime

Ads runtime must remain simple, predictable, and safe.
