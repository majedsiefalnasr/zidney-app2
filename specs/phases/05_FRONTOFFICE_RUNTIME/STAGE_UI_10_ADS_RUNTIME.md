# STAGE_UI_10_ADS_RUNTIME

Phase: 05_FRONTOFFICE_RUNTIME  
Layer: Frontend (Vue 3 + Phase 6 Runtime Core)  
Status: DRAFT  
Depends On:

- STAGE_UI_01_FRONTOFFICE_SHELL
- STAGE_UI_02_STUDENT_AUTH
- STAGE_UI_07_SUBSCRIPTION_AND_ACCESS_GATES
- STAGE_66_ADS_RUNTIME (Backend)

---

## Stage Status

Status: DRAFT

---

## Objective

Implement the Frontoffice Ads Runtime UI layer.

This stage defines:

- Ad slot rendering system
- Safe ad content display
- Placement rules (dashboard, library, results, etc.)
- Subscription-aware ad visibility
- Runtime ad refresh behavior

The frontend must NOT:

- Decide which ads are eligible
- Modify ad targeting rules
- Bypass subscription enforcement
- Trust ad content blindly

All ad eligibility and targeting logic is backend-controlled.

---

## Architectural Role

The Ads UI is:

- A rendering layer
- A safe display wrapper
- A placement controller

It is NOT:

- An ad decision engine
- A targeting engine
- A revenue calculator
- A campaign manager

Backend determines:

- Which ad is served
- Which slot it appears in
- Which user qualifies
- Impression tracking rules

---

## Primary Ad Slots

Initial supported placements:

- DASHBOARD_TOP
- DASHBOARD_SIDEBAR
- LIBRARY_INLINE
- RESULTS_PAGE
- ATTEMPT_SUMMARY

Frontend must only render slots returned by API.

No hardcoded ad injection.

---

## Data Contract

`GET /v1/frontoffice/ads`

Response must include:

- ads[]
  - ad_id
  - slot
  - content_type (IMAGE | HTML | VIDEO)
  - content_url or html_snippet
  - click_url
  - expires_at
  - display_duration

Frontend must:

- Render based on slot
- Respect expires_at
- Respect content_type

Frontend must NOT:

- Cache beyond expires_at
- Inject arbitrary HTML without sanitization

---

## Subscription Enforcement

Backend may suppress ads for:

- Premium subscriptions
- Enterprise tenants
- Trial periods

Frontend must:

- Render ads only when returned
- Never force display if none returned

No client-side subscription checks allowed.

---

## Rendering Rules

### IMAGE Ads

- Render with safe <img>
- Lazy-load
- Constrain max dimensions
- Open click_url in new tab with rel="noopener noreferrer"

### HTML Ads

- Must be sanitized before rendering
- Use sandboxed container
- Disallow inline script execution

### VIDEO Ads

- Use secure video player
- Autoplay disabled unless explicitly allowed
- Respect display_duration

---

## Impression & Click Tracking

Frontend must:

- Emit impression event when ad becomes visible
- Emit click event on interaction

Events:

- ad_impression
- ad_click

Payload must include:

- ad_id
- slot
- workspace_slug
- student_id
- request_id

No PII logged.

---

## Refresh Strategy

Ads may refresh:

- On route change
- On manual refresh
- After display_duration (if provided)

Frontend must:

- Avoid aggressive polling
- Use debounce/throttle strategy
- Prevent flicker during refresh

---

## Security Constraints

Frontend must:

- Never trust html_snippet blindly
- Never allow inline <script>
- Never allow external script injection
- Never expose internal state to ad iframe

If unsafe content detected:

- Do not render
- Log structured security event

---

## Performance Constraints

Ads must:

- Not block page rendering
- Load asynchronously
- Not increase initial bundle size significantly
- Avoid layout shifts (reserve slot height)

Target:

- No more than 5% increase in page render time

---

## Accessibility

Ads must:

- Include alt text for images
- Be keyboard accessible
- Provide descriptive aria-label for click targets
- Not auto-play audio

Ads must not degrade accessibility score.

---

## Error Handling

If ad fails to load:

- Hide slot gracefully
- Do not crash page
- Log event ad_render_error

If API fails:

- Continue rendering page without ads
- No blocking behavior

---

## State Management

Ads state must:

- Be isolated from business state
- Reset on logout
- Not persist in localStorage

No caching of expired ads.

---

## Observability

Log events:

- ads_loaded
- ad_impression
- ad_click
- ad_render_error

Must include:

- workspace_slug
- student_id
- route_name
- request_id

No ad content logged.

---

## Failure Conditions

Stage fails if:

- Ads shown to premium users when backend suppresses
- HTML ads execute script code
- Layout shift occurs due to late ad injection
- Join flow or exam runtime blocked by ad
- PII leaked through ad payload

---

## Exit Criteria

Stage complete when:

- All ad slots render correctly
- Subscription-based suppression respected
- Impression & click tracking verified
- No security warnings
- No console errors
- Performance budget maintained

Upon completion:

Frontoffice Ads Runtime layer is operational.

---

Constitutional Compliance Required  
Zidney Constitution v1.2.0
